// manage loading and caching resource
// query wraps basic get and post requests with success and failure callbacks
// requireAsset() will return null but will also trigger the asset to be loaded
// keep calling requireAsset() on a frame timer until the asset is ready
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from './geometry.js';

// internal functions
function Query (method, url, data, successHandler, errorHandler, timeout) {
	const xhr = new XMLHttpRequest();

	xhr.open(method, url, true);
	xhr.onreadystatechange = function () {
		let status;
		let data;
		if (xhr.readyState == 4) { // `DONE`
			status = xhr.status;
			if (status == 200) {
				if (xhr.responseText != '') {
					data = JSON.parse(xhr.responseText);
				}
				successHandler && successHandler(data);
			} else {
				errorHandler && errorHandler(status);
			}
			successHandler = null;
			errorHandler = null;
		}
	};
	if (timeout != undefined) {
		xhr.timeout = timeout;
	}

	if (data != null) {
		xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
		xhr.send(JSON.stringify(data));
	} else {
		xhr.send();
	}

	return xhr;
}

// public api
const query = {
	post: function (url, data, successHandler, errorHandler) {
		return Query('post', url, data, successHandler, errorHandler);
	},
	get: function (url, successHandler, errorHandler) {
		return Query('get', url, null, successHandler, errorHandler);
	},
};

// -- local cache of resource ---------------------
const cache = new Map();
const allImageData = new Map();
const allClipData = new Map();

function getImageData (name) {
	return allImageData.get(name);
}

function getClipData (name) {
	return allClipData.get(name);
}

function getCombinedClipData (fromClips) {
	// combine multiple clips, using the clip name as a default label where one does not exist
	const combinedClipData = new geometry.ClipData();
	for (const clipName of fromClips) {
		const otherData = allClipData.get(clipName);
		//  create a label for the whole clip being combined
		combinedClipData.labels.set(clipName, { startFrame: combinedClipData.frames.length + 1, endFrame: combinedClipData.frames.length + otherData.frames.length });
		// merge in labels for this other clip
		for (const [name, frames] of otherData.labels) {
			combinedClipData.labels.set(name, {
				startFrame: frames.startFrame + combinedClipData.frames.length,
				endFrame: frames.endFrame + combinedClipData.frames.length,
			});
		}
		for (const frame of otherData.frames) {
			combinedClipData.frames.push(frame);
		}
	}
	combinedClipData.linkResource();
	return combinedClipData;
}

function createCombinedClipData (name, clips) {
	allClipData.set(name, getCombinedClipData(clips));
	allClipData.get(name).name = name;
	return allClipData.get(name);
}

function createClip (name, frames, deferLink) {
	const clipData = new geometry.ClipData(name);
	if (frames && Array.isArray(frames)) {
		for (const frame of frames) {
			// special case where each frame is only a single image
			if (typeof frame == 'string') {
				const frameData = clipData.addFrame(null);
				frameData.addImageContent(
					null,
					allImageData.get(frame),
					0, 0, 1, 1, 0, 1
				);

			} else {
				const frameData = clipData.addFrame(frame.label);
				if (frame.content && Array.isArray(frame.content)) {
					for (const entry of frame.content) {
						if (entry.image) {
							frameData.addImageContent(
								entry.name,
								entry.image,
								entry.transform[0],
								entry.transform[1],
								entry.transform[2],
								entry.transform[3],
								entry.transform[4],
								entry.transform[5]
							);
						} else if (entry.clip) {
							frameData.addClipContent(
								entry.name,
								entry.clip,
								entry.transform[0],
								entry.transform[1],
								entry.transform[2],
								entry.transform[3],
								entry.transform[4],
								entry.transform[5],
								entry.transform[6]
							);
						} else {
							// do we need to detect unrecognised entries here?
							frameData.addDisplayListContent(
								entry.name,
								entry.transform[0],
								entry.transform[1],
								entry.transform[2],
								entry.transform[3],
								entry.transform[4],
								entry.transform[5],
								entry.transform[6]
							);
						}
					}
				}
			}
		}
	}

	allClipData.set(name, clipData);
	if (!deferLink) {
		clipData.linkResource({
			getImageData : getImageData,
			getClipData : getClipData,
		});
	}
	return clipData;
}

function getCached (type, name, url, retrieveCallback) {
	const key = type + ':' + name + ':' + url;
	let entry = cache.get(key);
	if (entry == null) {
		entry = {
			key : key,
			type : type,
			name : name,
			url : url,
			loaded : false,
			object : null,
		};
		cache.set(key, entry);
		retrieveCallback(entry);
	}

	if (entry.loaded) {
		return entry.object;
	}
}

function clearCached (entry) {
	cache.delete(entry.key);
}

function requireImage (url) {
	return getCached('image', url, url, (entry) => {
		entry.object = new Image();
		entry.object.onload = function () {
			entry.loaded = true;
		};
		entry.object.onerror = function () {
			clearCached(entry);
		};
		entry.object.src = url;
	});
}

function requireJson (url) {
	return getCached('json', url, url, (entry) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onreadystatechange = function () {
			let status;
			if (xhr.readyState == 4) { // `DONE`
				status = xhr.status;
				if (status == 200) {
					entry.loaded = true;
					entry.object = JSON.parse(xhr.responseText);
				} else {
					clearCached(entry);
				}
			}
		};
		xhr.send();
	});
}

function requireText (url) {
	return getCached('text', url, url, (entry) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onreadystatechange = function () {
			let status;
			if (xhr.readyState == 4) { // `DONE`
				status = xhr.status;
				if (status == 200) {
					entry.loaded = true;
					entry.object = xhr.responseText;
				} else {
					clearCached(entry);
				}
			}
		};
		xhr.send();
	});
}

function requireAsset (baseURL, name) {
	return getCached('asset', name, baseURL + name, (entry) => {
		// first make sure we have the data needed
		const json = requireJson(baseURL + name + '_description.json');
		if (json == null) {
			clearCached(entry);
			return;
		}
		entry.description = json;

		// now load all the required spritesheets
		let hasAllSheets = true;
		for (const sheet of entry.description.sheets) {
			if (sheet.image == null) {
				const image = requireImage(baseURL + sheet.file);
				if (image == null) {
					hasAllSheets = false;
				} else {
					sheet.image = image;
				}
			}
		}

		if (!hasAllSheets) {
			clearCached(entry);
			return;
		}

		// TODO: set up all the clip and image objects
		entry.loaded = true;
		entry.object = {
			imageData : {},
			clipData : {},
		};

		// load all supplied images for each sheet
		for (const sheet of entry.description.sheets) {
			if (Array.isArray(sheet.entries)) {
				for (const e of sheet.entries) {
					// add an image data entry per image
					const imageData = new geometry.ImageData(e.name, sheet.image, e.xy, e.uv);
					allImageData.set(e.name, imageData);
					entry.object.imageData[e.name] = imageData;
				}
			}
		}

		// create clipData object for each clipData
		const clipsAdded = [];
		if (entry.description.clips && Array.isArray(entry.description.clips)) {
			for (const clip of entry.description.clips) {
				const clipData = createClip(clip.name, clip.frames, true);
				entry.object.clipData[clipData.name] = clipData;
				clipsAdded.push(clipData);
			}
		}

		// second pass
		// re-link all imageData or clipData in the asset bundles from name to data
		// create frame label entries for all clips with start and end points
		for (const cd of clipsAdded) {
			cd.linkResource({
				getImageData : getImageData,
				getClipData : getClipData,
			});
		}
	});
}

function lateLinkClips (alertONError) {
	for (const cd of allClipData.values()) {
		cd.linkResource({
			getImageData : getImageData,
			getClipData : getClipData,
		}, alertONError);
	}
}

function requireAssets (baseURL, names) {
	// return true if all requested assets are available
	let available = true;
	for (const name of names) {
		if (requireAsset(baseURL, name) == null) {
			available = false;
		}
	}
	return available;
}

export { query, requireAsset, requireAssets, requireJson, requireImage, requireText, getImageData, getClipData, createClip, createCombinedClipData, getCombinedClipData, lateLinkClips };
