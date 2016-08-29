'use strict';
// manage loading and caching resources
// require_asset() will return null but will also trigger the asset to be loaded
// keep calling require_asset() on a frame timer until the asset is ready
// copyright 2016 Samuel Baird MIT Licence

define(['letter.geometry'], function (geometry) {
	// -- local cache of resources ---------------------
	var cache = {};
	var all_image_data = {};
	var all_clip_data = {};

	var get_image_data = function (name) {
		return all_image_data[name];
	}
	
	var get_clip_data = function (name) {
		return all_clip_data[name];
	}
	
	var get_cached = function (type, name, url, retrieve_callback) {
		var key = type + ':' + name + ':' + url
		var entry = cache[key];
		if (entry == null) {
			entry = {
				key : key,
				type : type,
				name : name,
				url : url,
				loaded : false,
				object : null,
			}
			cache[key] = entry;
			retrieve_callback(entry);
		}
		
		if (entry.loaded) {
			return entry.object;
		}
	}
	
	var clear_cached = function (entry) {
		cache[entry.key] = null;
	}
	
	var require_image = function (url) {
		return get_cached('image', url, url, function (entry) {
			entry.object = new Image();
			entry.object.onload = function () { entry.loaded = true; }
			entry.object.onerror = function () { clear_cached(entry); }
			entry.object.src = url;
		});
	};
	
	var require_fontface = function (name, url) {
		
	};
	
	var require_json = function (url) {
		return get_cached('json', url, url, function (entry) {
			var xhr = typeof XMLHttpRequest != 'undefined' ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
			xhr.open('GET', url, true);
			xhr.onreadystatechange = function() {
				var status;
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
	
	var require_text = function (url) {
		return get_cached('text', url, url, function (entry) {
			var xhr = typeof XMLHttpRequest != 'undefined' ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
			xhr.open('GET', url, true);
			xhr.onreadystatechange = function() {
				var status;
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
	
	var require_asset = function (base_url, name) {
		return get_cached('asset', name, base_url + name, function (entry) {
			// first make sure we have the data needed
			var json = require_json(base_url + name + '_description.json');
			if (json == null) {
				clear_cached(entry);
				return;
			}
			entry.description = json;
			
			// now load all the required spritesheets
			var has_all_sheets = true;
			for (var i = 0; i < entry.description.sheets.length; i++) {
				var sheet = entry.description.sheets[i];
				if (sheet.image == null) {
					var image = require_image(base_url + sheet.file);
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
			}
	
			// load all supplied images for each sheet
			entry.description.sheets.with_each(function (sheet) {
				sheet.entries.with_each(function (e) {
					// add an image data entry per image
					var image_data = new geometry.image_data(e.name, sheet.image, e.xy, e.uv);
					all_image_data[e.name] = image_data;
					entry.object.image_data[e.name] = image_data;
				});
			});
			
			// create clip_data object for each clip_data
			var clips_added = [];
			if (entry.description.clips.with_each) {
				entry.description.clips.with_each(function (clip) {
					var clip_data = new geometry.clip_data(clip.name);
					var frame_no = 0;
					clip.frames.with_each(function (frame) {
						frame_no++;
						var frame_data = clip_data.add_frame(frame.label);
						if (frame.content.with_each) {
							frame.content.with_each(function (entry) {
								if (entry.image) {
									frame_data.add_image_content(
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
									frame_data.add_clip_content(
										entry.name,
										entry.image,
										entry.transform[0],
										entry.transform[1],
										entry.transform[2],
										entry.transform[3],
										entry.transform[4],
										entry.transform[5],
										entry.transform[6]										
									);
								}
							});
						}
					});
				
					all_clip_data[clip_data.name] = clip_data
					entry.object.clip_data[clip_data.name] = clip_data
					clips_added.push(clip_data);
				});
			}
			
			// second pass
			// re-link all image_data or clip_data in the asset bundles from name to data
			// create frame label entries for all clips with start and end points
			clips_added.with_each(function (cd) {
				cd.link_resources({
					get_image_data : get_image_data,
					get_clip_data : get_clip_data
				});
			});			
		});
	}
	
	var require_assets = function (base_url, names) {
		// return true if all requested assets are available
		var available = true;
		names.with_each(function (name) {
			if (require_asset(base_url, name) == null) {
				available = false;
			}
		});
		return available;		
	}

	return {
		require_asset : require_asset,
		require_assets : require_assets,
		require_json : require_json,
		require_image : require_image,
		require_text : require_text,
		require_fontface : require_fontface,
		get_image_data : get_image_data,
		get_clip_data : get_clip_data,
	}
})
