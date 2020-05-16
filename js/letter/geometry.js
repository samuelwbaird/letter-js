'use strict';
// a set of types and functions implementing a 2D geometry system with transforms
// over canvas 2D transforms like scale and rotation instead of a matrix
// copyright 2016 Samuel Baird MIT Licence

define([], function () {

	// a point is any object with an x any y property
	// a rect is any object with an x, y, width and height property
	// a frame is any object with an x, y, width, height, offset_x and offset_y
	// a transform is any object with x, y, scale_x, scale_y, rotate, alpha
	
	// seems like introducing a proper class and constructor has additional overhead
	// in some circumstances, but is faster in others!

	var point = function (x, y) { return { x : x, y : y } }
	var rect = function (x, y, width, height) { return { x : x, y : y, width : width, height : height }}
	var transform = function (x, y, scale_x, scale_y, rotation, alpha) { return { x : x, y : y, scale_x : scale_x, scale_y : scale_y, rotation : rotation, alpha : alpha }}
	var default_transform = function () { return transform (0, 0, 1, 1, 0, 1); }
	
	var point_distance = function (point1, point2) {
		var x = (point1.x - point2.x)
		var y = (point1.y - point2.y)
		return Math.sqrt((x * x) + (y * y))
	}
	
	var rect_expand = function (rect, pad_x, pad_y) {
		return { x : rect.x - pad_x, y : rect.y - pad_x, width : rect.width + (pad_x * 2), height : rect.height + (pad_y * 2) }
	}
	
	var rect_contains_point = function (rect, point) {
		var px = point.x
		var py = point.y
		var x = rect.x
		var y = rect.y
		var width = rect.width
		var height = rect.height
		return (px >= x && py >= y && px <= x + width && py <= y + height)
	}	
	
	var rect_expand_to_include_point = function (rect, point) {
		if (rect == null) {
			return { x : point.x, y : point.y, width : 0, height : 0 }
		}

		var px = point.x
		var py = point.y
		var x = rect.x
		var y = rect.y
		var width = rect.width
		var height = rect.height
		
		if (px < x) {
			width = (x + width) - px
			x = px
		} else if (px > x + width) {
			width = px - x
		}
	
		if (py < y) {
			height = (y + height) - py
			y = py
		} else if (py > y + height) {
			height = py - y
		}
	
		return { x : x, y : y, width : width, height : height }
	}
	
	
	var transform_transform = function (parent, child) {
		// special case for rotation
		if (parent.rotation == 0) {
			return {
				x : parent.x + (parent.scale_x * child.x),
				y : parent.y + (parent.scale_y * child.y),
				scale_x : parent.scale_x * child.scale_x,
				scale_y : parent.scale_y * child.scale_y,
				rotation : parent.rotation + child.rotation,
				alpha : parent.alpha * child.alpha
			}
		} else {
			var c = Math.cos(parent.rotation)
			var s = Math.sin(parent.rotation)
			return {
				x : parent.x + (parent.scale_x * child.x * c) - (parent.scale_y * child.y * s),
				y : parent.y + (parent.scale_y * child.y * c) + (parent.scale_x * child.x * s),
				scale_x : parent.scale_x * child.scale_x,
				scale_y : parent.scale_y * child.scale_y,
				rotation : parent.rotation + child.rotation,
				alpha : parent.alpha * child.alpha
			}
		}
	}
	
	var transform_point = function (transform, point) {
		// special case for 0 rotation
		if (transform.rotation == 0) {
			return { x : transform.x + (transform.scale_x * point.x), y : transform.y + (transform.scale_y * point.y) }
		} else {
			var c = Math.cos(transform.rotation)
			var s = Math.sin(transform.rotation)
			return {
				x : transform.x + (transform.scale_x * point.x * c) - (transform.scale_y * point.y * s),
				y : transform.y + (transform.scale_y * point.y * c) + (transform.scale_x * point.x * s),
			}
		}
	}
	
	var untransform_point = function (transform, point) {
		// special case for 0 rotation
		if (transform.rotation == 0) {
			return {
				x : (point.x - transform.x) / transform.scale_x,
				y : (point.y - transform.y) / transform.scale_y
			}
		} else {
			var c = Math.cos(-transform.rotation)
			var s = Math.sin(-transform.rotation)
			var x = (x - transform.x) / transform.scale_x
			var y = (y - transform.y) / transform.scale_y
			return {
				x : (transform.scale_x * x * c) - (transform.scale_y * y * s),
				y : (transform.scale_y * y * c) - (transform.scale_x * x * s)
			}
		}
	}
	
	var color = klass(function (color) {
		color.init = function (r, g, b, a) {
			this.r = r
			this.g = g
			this.b = b
			this.alpha = a
		}
		
		color.fill_style = function () {
			return 'rgb(' + Math.floor(this.r * 255) + ',' + Math.floor(this.g * 255) + ',' + Math.floor(this.b * 255) + ')';
		}
	})
	
	// static stuff for color
	color.white = new color(1, 1, 1, 1)
	color.black = new color(0, 0, 0, 1)
	color.clear = new color(0, 0, 0, 0)
	color.grey = function (grey_level) {
		return new color(grey_level, grey_level, grey_level, 1)
	}
	
	var font = klass(function (font) {
		// treat as immutable once set
		font.init = function (ctx, size, name, align, baseline) {
			this.ctx = ctx;
			this.size = (size != undefined ? size : 11);
			this.name = (name != undefined ? name : 'sans-serif');
			this.align = (align != undefined ? align : 'start');
			this.baseline = (baseline != undefined ? baseline : 'middle');
			this.font = this.size + 'px ' + this.name;
			
			// measure the line height as soon as we can
			this.set();
			var measure = ctx.measureText('L');
			if (measure.emHeightDescent) {
				this.line_height = measure.emHeightDescent + measure.emHeightAscent;
			} else {
				this.line_height = size;
			}
			// cache the measured width of letters
			this.letter_cache = new cache(1024);
			// cache the line breaks of lines
			this.lines_cache = new cache(128);
		}
		
		font.set = function (ctx, force) {
			if (ctx == undefined) {
				ctx = this.ctx;
			}
			ctx.font = this.font;
			ctx.textAlign = this.align;
			ctx.textBaseline = this.baseline;
		}
		
		// measure a letter and cache the result
		font.measure_string = function (str) {
			var entry = this.letter_cache.get(str);
			if (entry != undefined) {
				return entry;

			}
			this.set();
			var measure = this.ctx.measureText(str);
			this.letter_cache.set(str, measure.width);
			return measure.width;
		}
		
		font.breaklines = function (text, word_wrap) {
			if (word_wrap == undefined || word_wrap == 0 || text == null) {
				return [text];
			} else {
				var key = word_wrap + ':' + text;
				var entry = this.lines_cache.get(key);
				if (entry != undefined) {
					return entry;
				}
				
				var lines = [];
				var current_line = '';
				var current_line_width = 0;
				var current_word = '';
				var current_word_width = 0;
				for (var i = 0; i < text.length; i++) {
					var char = text.charAt(i);
					var can_break = (char === ' ' || char === '.' || char === '\t' || char === ',');
					var width = this.measure_string(char);
					
					if (current_line != '' && width + current_word_width + current_line_width > word_wrap) {
						// move to the next line
						lines.push(current_line);
						current_line = '';
						current_line_width = 0;
					}
					// add char to the current word
					current_word = current_word + char;
					current_word_width += width;
					if (can_break) {
						current_line = current_line + current_word;
						current_line_width += current_word_width;
						current_word = '';
						current_word_width = 0;
					}
				}
				current_line = current_line + current_word;
				if (current_line != '') {
					lines.push(current_line);
				}
				
				this.lines_cache.set(key, lines);
				return lines;
			}
		}
		
		font.measure = function (text, word_wrap) {
			var x = 0;
			var y = 0;
			
			var lines = this.breaklines(text, word_wrap);
			var width = (lines.length == 1) ? this.measure_string(lines[0]) : word_wrap;
			var height = lines.length * this.line_height;

			// TODO: adjust for baseline and hanging
			y -= this.line_height * 0.5;
			
			// adjust for text align
			// TODO: check locale with respect to start and end
			if (this.align == 'start' || this.align == 'left') {
				// do nothing
			} else if (this.align == 'center') {
				x -= width * 0.5;
			} else if (this.align == 'end' || this.align == 'right') {
				x -= width;
			}
			
			return {
				x : x,
				y : y,
				width : width,
				height : height,
				lines : lines,
				line_height : this.line_height,
				padding : this.line_height * 0.5
			}
		}
		
	});
	
	var image_data = klass(function (image_data) {
		image_data.init = function (name, texture, xy, uv) {
			this.name = name;
			this.texture = texture;
			
			this.source_rect = rect(uv[0] * texture.width, uv[1] * texture.height, (uv[2] - uv[0]) * texture.width, (uv[3] - uv[1]) * texture.height); 
			this.dest_rect = rect(xy[0], xy[1], xy[2] - xy[0], xy[3] - xy[1])
		}
		
		image_data.bounds = function () {
			return this.dest_rect
		}
	});
	
	var clip_data = klass(function (clip_data) {
		clip_data.init = function (name) {
			this.name = name
			this.frames = [];
			this.labels = {};			
		}
		
		var clip_frame = klass(function (clip_frame) {
			clip_frame.init = function (label) {
				this.label = label;
				this.content = [];
			}
			
			clip_frame.generate_instance_name = function (name) {
				var count = 1
				this.content.with_each(function (c, data) {
					if (c.image_data == data || c.clip_data == data) {
						count++;
					}
				});
				return '_' + name + '_' + count;
			}
			
			clip_frame.add_image_content = function (instance_name, image_data, x, y, scale_x, scale_y, rotation, alpha) {
				if (!instance_name) {
					instance_name = this.generate_instance_name('img_' + image_data.name, image_data);
				}
				var entry = {
					instance_name : instance_name,
					image_data : image_data,
					x : (x !== undefined) ? x : 0,
					y : (y !== undefined) ? y : 0,
					scale_x : (scale_x !== undefined) ? scale_y : 0,
					scale_y : (scale_y !== undefined) ? scale_y : 0,
					rotation : (rotation !== undefined) ? rotation : 0,
					alpha : (alpha !== undefined) ? alpha : 0,
				}
				this.content.push(entry);
				return this;
			}
			
			clip_frame.add_clip_content = function (instance_name, clip_data, x, y, scale_x, scale_y, rotation, alpha, frame_no) {
				if (!instance_name) {
					instance_name = this.generate_instance_name('img_' + clip_data.name, clip_data);
				}
				var entry = {
					instance_name : instance_name,
					clip_data : clip_data,
					x : (x !== undefined) ? x : 0,
					y : (y !== undefined) ? y : 0,
					scale_x : (scale_x !== undefined) ? scale_y : 0,
					scale_y : (scale_y !== undefined) ? scale_y : 0,
					rotation : (rotation !== undefined) ? rotation : 0,
					alpha : (alpha !== undefined) ? alpha : 0,
					frame_no : frame_no,
				}
				this.content.push(entry);
				return this;
			}
		})
		
		clip_data.add_frame = function (label) {
			var frame = new clip_frame(label);
			this.frames.push(frame);
			return frame;
		}
		
		clip_data.link_resources = function (resources) {
			// generate start and end points for all labels during this pass
			this.labels['all'] = { start_frame : 1, end_frame: this.frames.length };
			var tracking_label = null;
			var frame_no = 0;
			this.frames.with_each(function (frame) {
				frame_no++;
				if (frame.label) {
					tracking_label = { start_frame : frame_no, end_frame : frame_no }
					this.labels[frame.label] = tracking_label;
				} else if (tracking_label) {
					tracking_label.end_frame = frame_no;
				}

				// -- link image_data and clip_data objects directly
				frame.content.with_each(function (c) {
					if (c.image_data && typeof c.image_data == 'string') {
						c.image_data = resources.get_image_data(c.image_data);
					}
					if (c.clip_data && typeof c.clip_data == 'string') {
						c.clip_data = resources.get_clip_data(c.clip_data);
					}
				});
			})
		}
	});	
	
	return  {
		// plain objects and function
		point : point,
		rect : rect,
		transform : transform,
		
		default_transform : default_transform,
		
		point_distance : point_distance,
		rect_contains_point : rect_contains_point,
		rect_expand : rect_expand,
		rect_expand_to_include_point : rect_expand_to_include_point,
		transform_transform : transform_transform,
		transform_point : transform_point,
		untransform_point : untransform_point,
		
		// classes
		color : color,
		font : font,
		image_data : image_data,
		clip_data : clip_data
	};
})