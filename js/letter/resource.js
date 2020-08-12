// manage loading and caching resource
// query wraps basic get and post requests with success and failure callbacks
// require_asset() will return null but will also trigger the asset to be loaded
// keep calling require_asset() on a frame timer until the asset is ready
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from './geometry.js';

// internal functions
function _query (method, url, data, successHandler, errorHandler, timeout) {
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
		return _query('post', url, data, successHandler, errorHandler);
	},
	get: function (url, successHandler, errorHandler) {
		return _query('get', url, null, successHandler, errorHandler);
	},
};

// -- local cache of resource ---------------------
const cache = new Map();
const all_image_data = new Map();
const all_clip_data = new Map();

function get_image_data (name) {
	return all_image_data.get(name);
}

function get_clip_data (name) {
	return all_clip_data.get(name);
}

function get_combined_clip_data (from_clips) {
	// combine multiple clips, using the clip name as a default label where one does not exist
	const combined_clip_data = new geometry.clip_data();
	for (const clip_name of from_clips) {
		const other_data = all_clip_data.get(clip_name);
		//  create a label for the whole clip being combined
		combined_clip_data.labels[clip_name] = { start_frame: combined_clip_data.frames.length + 1, end_frame: combined_clip_data.frames.length + other_data.frames.length };
		// merge in labels for this other clip
		for (const [name, frames] of other_data.labels) {
			combined_clip_data.labels[name] = {
				start_frame: frames.start_frame + combined_clip_data.frames.length,
				end_frame: frames.end_frame + combined_clip_data.frames.length,
			};
		}
		for (const frame of other_data.frames) {
			combined_clip_data.frames.push(frame);
		}
	}
	combined_clip_data.link_resource();
	return combined_clip_data;
}

function create_combined_clip_data (name, clips) {
	all_clip_data.set(name, get_combined_clip_data(clips));
	all_clip_data.get(name).name = name;
	return all_clip_data.get(name);
}

function get_cached (type, name, url, retrieve_callback) {
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
		retrieve_callback(entry);
	}

	if (entry.loaded) {
		return entry.object;
	}
}

function clear_cached (entry) {
	cache.delete(entry.key);
}

function require_image (url) {
	return get_cached('image', url, url, (entry) => {
		entry.object = new Image();
		entry.object.onload = function () {
			entry.loaded = true;
		};
		entry.object.onerror = function () {
			clear_cached(entry);
		};
		entry.object.src = url;
	});
}

function require_json (url) {
	return get_cached('json', url, url, (entry) => {
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
					clear_cached(entry);
				}
			}
		};
		xhr.send();
	});
}

function require_text (url) {
	return get_cached('text', url, url, (entry) => {
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
					clear_cached(entry);
				}
			}
		};
		xhr.send();
	});
}

function require_asset (base_url, name) {
	return get_cached('asset', name, base_url + name, (entry) => {
		// first make sure we have the data needed
		const json = require_json(base_url + name + '_description.json');
		if (json == null) {
			clear_cached(entry);
			return;
		}
		entry.description = json;

		// now load all the required spritesheets
		let has_all_sheets = true;
		for (const sheet of entry.description.sheets) {
			if (sheet.image == null) {
				const image = require_image(base_url + sheet.file);
				if (image == null) {
					has_all_sheets = false;
				} else {
					sheet.image = image;
				}
			}
		}

		if (!has_all_sheets) {
			clear_cached(entry);
			return;
		}

		// TODO: set up all the clip and image objects
		entry.loaded = true;
		entry.object = {
			image_data : {},
			clip_data : {},
		};

		// load all supplied images for each sheet
		for (const sheet of entry.description.sheets) {
			for (const e of sheet.entries) {
				// add an image data entry per image
				const image_data = new geometry.image_data(e.name, sheet.image, e.xy, e.uv);
				all_image_data.set(e.name, image_data);
				entry.object.image_data[e.name] = image_data;
			}
		}

		// create clip_data object for each clip_data
		const clips_added = [];
		if (entry.description.clips && Array.isArray(entry.description.clips)) {
			for (const clip of entry.description.clips) {
				const clip_data = new geometry.clip_data(clip.name);
				for (const frame of clip.frames) {
					// special case where each frame is only a single image
					if (typeof frame == 'string') {
						const frame_data = clip_data.add_frame(null);
						frame_data.add_image_content(
							null,
							all_image_data.get(frame),
							0, 0, 1, 1, 0, 1
						);

					} else {
						const frame_data = clip_data.add_frame(frame.label);
						if (frame.content) {
							for (const entry of frame.content) {
								if (entry.image) {
									frame_data.add_image_content(
										entry.name,
										entry.image, // all_image_data.get(entry.image),
										entry.transform[0],
										entry.transform[1],
										entry.transform[2],
										entry.transform[3],
										entry.transform[4],
										entry.transform[5]
									);
								} else if (entry.clip) {
									frame_data.add_clip_content(
										entry.name,
										entry.clip, //all_clip_data(entry.clip),
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

				all_clip_data.set(clip_data.name, clip_data);
				entry.object.clip_data[clip_data.name] = clip_data;
				clips_added.push(clip_data);
			}
		}

		// second pass
		// re-link all image_data or clip_data in the asset bundles from name to data
		// create frame label entries for all clips with start and end points
		for (const cd of clips_added) {
			cd.link_resource({
				get_image_data : get_image_data,
				get_clip_data : get_clip_data,
			});
		}
	});
}

function require_assets (base_url, names) {
	// return true if all requested assets are available
	let available = true;
	for (const name of names) {
		if (require_asset(base_url, name) == null) {
			available = false;
		}
	}
	return available;
}

export { query, require_asset, require_assets, require_json, require_image, require_text, get_image_data, get_clip_data, create_combined_clip_data, get_combined_clip_data };
