'use strict';
// implements a range of AS3 style display list classes, rendering into a 2D canvas context
// copyright 2016 Samuel Baird MIT Licence

define(['letter.geometry', 'letter.resources'], function (geometry, resources) {
	
	var display_list = klass(function (display_list) {
		display_list.init = function (init_values) {
			// this.name = null;
			// this.parent = null;
			// this.children = null;
			
			this.x = 0;
			this.y = 0;
			this.scale_x = 1;
			this.scale_y = 1;
			this.rotation = 0;
			this.alpha = 1;
			this.visible = true;
			
			if (init_values) {
				for (var k in init_values) {
					this[k] = init_values[k];
				}
			}
		}
		
		// -- manage children ------------
		
		display_list.get_children = function () {
			if (!this.children) {
				this.children = [];
			}
			return this.children;
		}
		
		display_list.add = function (display) {
			if (display.parent) {
				display.remove_from_parent();
			}
			this.get_children().push(display);
			display.parent = this;
		}
		
		display_list.add_at_index = function (display, index) {
			if (display.parent) {
				display.remove_from_parent();
			}
			this.get_children().splice(index, 0, display);
			display.parent = this;
		}
		
		display_list.send_to_front = function (display) {
			if (display) {
				if (display.parent) {
					display.remove_from_parent();
				}
				this.get_children().push(display);
				display.parent = this;
			} else if (this.parent) {
				this.parent.send_to_front(this);
			}
		}
		
		display_list.send_to_back = function (display) {
			if (display) {
				this.add_at_index(display, 0);
			} else if (this.parent) {
				this.parent.send_to_back(this);
			}
		}
		
		display_list.remove = function (display) {
			if (display.parent == this) {
				var index = this.children.indexOf(display);
				this.children.splice(index, 1);
				display.parent = null;
			}
		}
		
		display_list.remove_from_parent = function () {
			if (this.parent) {
				this.parent.remove(this);
			}
		}
		
		display_list.remove_all_children = function () {
			if (this.children) {
				for (var i = 0, len = this.children.length; i < len; i++) {
					this.children[i].parent = null;
				}
				this.children = null;
			}
		}
		
		// -- transforms -----------------
		
		display_list.transform = function () {
			return this;	// assume I'm going to regret this at some point...
		}
		
		display_list.world_transform = function () {
			if (this.parent) {
				return geometry.transform_transform(this.parent.world_transform(), this);
			} else {
				return this;
			}
		}
		
		display_list.local_to_world = function (point) {
			var world = this.world_transform();
			return geometry.transform_point(world, point);
		}
		
		display_list.world_to_local = function (point) {
			var world = this.world_transform();
			return geometry.untransform_point(world, point);
		}
		
		// -- bounds ----------------------
		
		display_list.bounds = function (reference) {
			// starting point
			var rect = this.frozen_bounds;
			if (rect == null) {
				rect = this.content_bounds();
				// expand to fit children
				if (this.children) {
					for (var i = 0, len = this.children.length; i < len; i++) {
						var child = this.children[i];
						var sub_rect = child.bounds()
						if (sub_rect) {
							// all points of the bound transformed
							var points = [
								geometry.transform_point(child, { x : sub_rect.x, y : sub_rect.y }),
								geometry.transform_point(child, { x : sub_rect.x + sub_rect.width, y : sub_rect.y }),
								geometry.transform_point(child, { x : sub_rect.x, y : sub_rect.y + sub_rect.height }),
								geometry.transform_point(child, { x : sub_rect.x + sub_rect.width, y : sub_rect.y + sub_rect.height })
							];
							for (var j = 0; j < 4; j++) {
								rect = geometry.rect_expand_to_include_point(rect, points[j]);
							}
						}
					}
				}
			}
			// convert to requested reference point
			if (!rect || !reference) {
				return rect;
			} else {
				var world = this.world_transform()
				var points = [
					geometry.untransform_point(world, { x : rect.x, y : rect.y }),
					geometry.untransform_point(world, { x : rect.x + rect.width, y : rect.y }),
					geometry.untransform_point(world, { x : rect.x, y : rect.y + rect.height }),
					geometry.untransform_point(world, { x : rect.x + rect.width, y : rect.y + rect.height })
				];
				var out = null;
				var ref = reference.world_transform()
				for (var j = 0; j < 4; j++) {
					rect = geometry.rect_expand_to_include_point(rect, geometry.untransform_point(ref, points[j]));
				}
				return rect;
			}
		}
		
		display_list.content_bounds = function () {
			// get bounds without any reference point
			// derived classes should implement only this method
			return null;
		}
		
		display_list.is_visible = function () {
			if (!this.visible || this.alpha < 0.01) {
				return false;
			}
			
			if (this.parent) {
				return this.parent.is_visible();
			}

			return true
		}
		
		// -- cache/freeze as bitmap ------------------------
		
		// display.freeze_fast freeze to image_data that is rendered using image_data instead of as a canvas
		
		display_list.freeze = function (optional_bounds, scale_factor) {
			if (optional_bounds == undefined) {
				optional_bounds = this.bounds();
			}
			if (scale_factor == undefined) {
				scale_factor = 1;
			}
			
			this.frozen_bounds = optional_bounds;
			var temporary_ctx = null;
			var required_width = this.frozen_bounds.width * scale_factor;
			var required_height = this.frozen_bounds.height * scale_factor;
			
			if (this.frozen_image_canvas == null || this.frozen_image_canvas.width != required_width || this.frozen_image_canvas.height != required_height) {
				// new or different size
				this.frozen_image_canvas = document.createElement('canvas');
				this.frozen_image_canvas.width = required_width;
				this.frozen_image_canvas.height = required_height;
				temporary_ctx = this.frozen_image_canvas.getContext('2d');
			} else {
				// clear and re-use
				temporary_ctx = this.frozen_image_canvas.getContext('2d');
				temporary_ctx.clearRect(0, 0, this.frozen_image_canvas.width, this.frozen_image_canvas.height);
			}
			
			var transform = geometry.default_transform();
			
			transform.x = -this.frozen_bounds.x * scale_factor;
			transform.y = -this.frozen_bounds.y * scale_factor;
			transform.scale_x = transform.scale_y = scale_factor;
			if (this.content_render) {
				this.content_render(temporary_ctx, transform);
			}
			if (this.children) {
				for (var i = 0, len = this.children.length; i < len; i++) {
					this.children[i].render(temporary_ctx, transform);
				}
			}
			
			// this.frozen_image_data = temporary_ctx.getImageData(0, 0, this.frozen_bounds.width, this.frozen_bounds.height);
			this.is_frozen = true;
		}
		
		display_list.unfreeze = function () {
			this.is_frozen = false;
			this.frozen_image_canvas = null;
			this.frozen_bounds = null;
		}

		// -- render -----------------------------------------
	
		display_list.update_animated_clips = function (delta, add_oncomplete_callback) {
			if (this.update) {
				this.update(delta, add_oncomplete_callback);
			}
			if (this.children) {
				for (var i = 0, len = this.children.length; i < len; i++) {
					this.children[i].update_animated_clips(delta, add_oncomplete_callback)
				}
			}
		}
	
		display_list.render = function (ctx, with_transform) {
			if (!this.visible || this.alpha == 0) {
				return;
			}
			
			// transform within parent
			var transform = geometry.transform_transform(with_transform, this);
			if (transform.alpha < 0.001) {
				return;
			}
			
			if (this.is_frozen) {
			    ctx.save();
				ctx.translate(transform.x, transform.y);
				ctx.rotate(transform.rotation);
			    ctx.scale(transform.scale_x, transform.scale_y);
				ctx.globalAlpha = transform.alpha;
				ctx.drawImage(this.frozen_image_canvas,
							0, 0, this.frozen_image_canvas.width, this.frozen_image_canvas.height,
							this.frozen_bounds.x, this.frozen_bounds.y, this.frozen_bounds.width, this.frozen_bounds.height);
							
				ctx.restore();			
				
			} else {
				if (this.content_render) {
					this.content_render(ctx, transform);
				}
				if (this.children) {
					for (var i = 0, len = this.children.length; i < len; i++) {
						this.children[i].render(ctx, transform);
					}
				}
			}
		}
		
		// -- override / customise for different display object types ------------
		
		// display_list.update = function (delta) {} // update animations
		// display_list.content_render = function (ctx, transform) {} // render actual content at this level with the given transform
	});
	
	// -- derived type rendering an image
	
	var image = derive(display_list, function (base, image) {
		
		image.init = function (image_data_or_name, init_values) {
			base.init.apply(this, [ init_values ]);
			if (typeof image_data_or_name == 'string') {
				this.image_data = resources.get_image_data(image_data_or_name);
			} else {
				this.image_data = image_data_or_name;
			}
		}
		
		image.content_render = function (ctx, transform) {
		    ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
		    ctx.scale(transform.scale_x, transform.scale_y);
			ctx.globalAlpha = transform.alpha;
			
			var src = this.image_data.source_rect
			var dst = this.image_data.dest_rect
			ctx.drawImage(this.image_data.texture, src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height)

		    ctx.restore();			
		}
		
		image.content_bounds = function () {
			return this.image_data.bounds();
		}
		
	});
	
	// -- derived type rendering an image
	
	var clip = derive(display_list, function (base, clip) {
		
		clip.init = function (clip_data_or_name, init_values) {
			base.init.apply(this, [ init_values ]);
			this.children = [];
			
			if (typeof clip_data_or_name == 'string') {
				this.clip_data = resources.get_clip_data(clip_data_or_name);
			} else {
				this.clip_data = clip_data_or_name;
			}
			
			this.playback_speed = 1
			this.playback_position = 1

			this.is_playing = false
			this.start_frame = 1
			this.end_frame = this.clip_data.frames.length
			this.loop = true

			this.current_frame = null
			this.set_frame(this.clip_data.frames[0]);			
		}
		
		clip.stop = function () {
			this.is_playing = false;
		}
		
		clip.play = function (arg1, arg2, arg3, arg4) {
			var goto_frame = null;
			this.is_playing = true;
			this.on_complete = null;
			
			var label_was_set = false;
			var loop_was_set = false;
			var on_complete_was_set = false;
			
			var args = [arg1, arg2, arg3, arg4];
			for (var i = 0; i < args.length; i++) {
				var arg = args[i];
				if (typeof arg == 'boolean') {
					loop_was_set = true;
					this.loop = arg;
				} else if (typeof arg == 'string') {
					if (label_was_set) {
						throw "only one label string argument is allowed";
					} else {
						if (!loop_was_set) {
							this.loop = false;
						}
						var frames = this.clip_data.labels[arg]
						if (!frames) {
							throw "unknown frame " + arg + " in clip " + this.clip_data.name;
						}
						this.start_frame = frames.start_frame;
						this.end_frame = frames.end_frame;
						this.playback_position = this.start_frame
						label_was_set = true;
					}
				} else if (typeof arg == 'function') {
					if (on_complete_was_set) {
						throw "only one on_complete function argument is allowed";
					}
					if (!loop_was_set) {
						this.loop = false;
					}
					this.on_complete = arg;
					on_complete_was_set = true;
				}
				
			}
			// -- check for start and end labels specified as numbers
			if (typeof arg1 == 'number' && typeof arg2 == 'number') {
				if (label_was_set) {
					throw 'cannot set a label and frame numbers';
				}
				this.start_frame = arg1;
				this.end_frame = arg2;
			}
			
			if (this.loop && this.on_complete) {
				throw 'on_complete will not be used with looping animation';
			}
		}
		
		clip.goto = function (label_or_number) {
			if (typeof label_or_number == 'number') {
				this.start_frame = label_or_number;
				this.end_frame = label_or_number;
			} else {
				var frames = this.clip_data.labels[label_or_number];
				if (!frames) {
					throw "unknown frame " + label_or_number + " in clip " + this.clip_data.name;
				}
				this.start_frame = frames.start_frame;
				this.end_frame = frames.start_frame;
			}
	
			this.is_playing = false
			this.set_frame(this.clip_data.frames[this.start_frame - 1])
		}
	
		clip.update = function (delta, add_oncomplete_callback) {
			if (!this.is_playing) {
				return;
			}
			
			this.playback_position += this.playback_speed;
			if (Math.floor(this.playback_position) > this.end_frame) {
				if (this.loop) {
					while (Math.floor(this.playback_position) > this.end_frame) {
						this.playback_position -= (this.end_frame - this.start_frame) + 1;
					}
				} else {
					this.playback_position = this.end_frame;
					this.is_playing = false;
				}
			}
			
			var frame = this.clip_data.frames[Math.floor(this.playback_position) - 1];
			if (frame != this.current_frame) {
				this.set_frame(frame);
			}
			
			if (!this.is_playing) {
				if (this.on_complete) {
					add_oncomplete_callback(this.on_complete);
					this.on_complete = null;
				}
			}
		}
		
		clip.set_frame = function (frame) {
			if (!frame) {
				throw "setting invalid frame";
			}
			this.current_frame = frame;
			
			// -- retain a list of current content (re-use objects where they match)
			var current = {}
			var remove = {}
			var index = 0;
			this.children.with_each = function (child) {
				if (child.name) {
					current[child.name] = child;
				} else {
					current['__' + index] = child;
				}
				index++;
			}
			
			// -- recreate the child display list, re-using objects
			for (var index = 0, l = frame.content.length; index < l; index++) {
				var content = frame.content[index];
				var child = current[content.instance_name];
				if (child) {
					// -- move it to the correct index
					this.children[index] = child
					// -- make sure this is not removed later
					current[content.instance_name] = null					
				} else {
					// -- create a new child clip
					if (content.image_data) {
						child = new image(content.image_data);
					} else if (content.clip_data) {
						child = new clip.constructor(content.clip_data);
						// -- if frame is not specified then the sub clip should play
						if (!content.frame_no) {
							child:play()
						}
					}
					child.parent = this
					this.children[index] = child
				}
				
				// -- apply the new transform
				child.x = content.x
				child.y = content.y
				child.scale_x = content.scale_x
				child.scale_y = content.scale_y
				child.rotation = content.rotation
				child.alpha = content.alpha
				if (content.frame_no) {
					child.goto_and_stop(content.frame_no)
				}
			}
			
			// -- trim extra child references
			this.children.splice(frame.content.length);
			current.with_each(function (name, child) {
				child.parent = null;
			});
		}
	});
	
	// -- derived type rendering a rectangle
	
	var rect = derive(display_list, function (base, rect) {
		rect.init = function (width, height, color, init_values) {
			base.init.apply(this, [ init_values ]);
			this.width = width;
			this.height = height;
			this.color = color;
		}
		
		rect.content_render = function (ctx, transform) {
		    ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
		    ctx.scale(transform.scale_x, transform.scale_y);
			ctx.globalAlpha = this.color.alpha * transform.alpha;
			ctx.fillStyle = this.color.fill_style();
			ctx.fillRect(0, 0, this.width, this.height);
		    ctx.restore();			
		}
		
		rect.content_bounds = function () {
			return { x : 0, y : 0, width : this.width, height : this.height }
		}
		
	});
	
	var circle = derive(display_list, function (base, circle) {
		circle.init = function (radius, color, init_values) {
			base.init.apply(this, [ init_values ]);
			this.radius = radius;
			this.color = color;
		}
		
		circle.content_render = function (ctx, transform) {
		    ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
		    ctx.scale(transform.scale_x, transform.scale_y);
			ctx.globalAlpha = this.color.alpha * transform.alpha;
			ctx.fillStyle = this.color.fill_style();
		    ctx.beginPath();
			ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
			ctx.fill();
		    ctx.restore();			
		}
		
		circle.content_bounds = function () {
			return { x : -this.radius, y : -this.radius, width : this.radius * 2, height : this.radius * 2 }
		}
	});
	
	var canvas = derive(display_list, function (base, canvas) {
		canvas.init = function (bounds, on_render, init_values) {
			base.init.apply(this, [ init_values ]);
			this.bounds = bounds;
			this.on_render = on_render;
		}
		
		canvas.content_render = function (ctx, transform) {
		    ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
		    ctx.scale(transform.scale_x, transform.scale_y);
			ctx.globalAlpha = this.color.alpha * transform.alpha;
			this.on_render(ctx);
		    ctx.restore();
		}
		
		canvas.content_bounds = function () {
			return this.bounds;
		}
	});
	
	var label = derive(display_list, function (base, label) {
		label.init = function (font, text, color, init_values) {
			// TODO: set word_wrap to a number to wrap lines at a maximum length
			this.word_wrap = undefined;
			this.vertical_align = 'center';

			base.init.apply(this, [ init_values ]);
			this.font = font;
			this.text = text;
			this.color = (color != undefined ? color : geometry.color.black);
			
			
			this.last_break = null;
			this.last_lines = null;
		}
		
		label.content_render = function (ctx, transform) {
		    ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
		    ctx.scale(transform.scale_x, transform.scale_y);
			ctx.globalAlpha = this.color.alpha * transform.alpha;
			ctx.fillStyle = this.color.fill_style();
			this.font.set(ctx);
			
			var tx = 0;
			var ty = 0;
			// adjust for vertical_align
			if (this.vertical_align == 'center' || this.vertical_align == 'middle') {
				// do nothing
			} else if (this.vertical_align == 'top') {
				ty += this.font.line_height * 0.5;
			} else if (this.vertical_align == 'bottom') {
				ty -= this.font.line_height * 0.5;
			}
			
			if (this.word_wrap == undefined) {
				ctx.fillText(this.text, tx, ty);
			} else {
				var this_break = this.word_wrap + ':' + this.text;
				var lines = this.last_lines;
				if (this_break != this.last_break) {
					this.last_break = this_break;
					lines = this.last_lines = this.font.breaklines(this.text, this.word_wrap);
				}
				// adjust for vertical_align
				if (this.vertical_align == 'center' || this.vertical_align == 'middle') {
					ty -= (lines.length - 1) * 0.5 * this.font.line_height;
				} else if (this.vertical_align == 'top') {
					// do nothing
				} else if (this.vertical_align == 'bottom') {
					ty -= (lines.length - 1) * this.font.line_height;
				}
				
				for (var l = 0; l < lines.length; l++) {
					ctx.fillText(lines[l], tx, ty);
					ty += this.font.line_height;
				}
			}
		    ctx.restore();
		}
		
		label.content_bounds = function () {
			var font_bounds = this.font.measure(this.text, this.word_wrap);
			var bounds = geometry.rect_expand(font_bounds, font_bounds.padding, font_bounds.padding);
			
			// adjust for vertical_align
			if (this.vertical_align == 'center') {
				bounds.y -= (font_bounds.lines.length - 1) * 0.5 * font_bounds.line_height;
			} else if (this.vertical_align == 'top') {
				bounds.y += font_bounds.line_height * 0.5;				
			} else if (this.vertical_align == 'bottom') {
				bounds.y -= (font_bounds.lines.length - 0.5) * font_bounds.line_height;
			}
			
			return bounds;
		}
	});
	
	// set up add methods from each class to each other class
	var klasses = {
		'display_list' : display_list,
		'image' : image,
		'clip' : clip,
		'rect' : rect,
		'circle' : circle,
		'canvas' : canvas,
		'label' : label
	}
	
	var augment = function (class1, class2, name) {
		var unpack_version = function (packed) {
			class2.prototype.init.apply(this, packed);
		};
		unpack_version.prototype = class2.prototype;

		class1.prototype['add_' + name] = function () {
			var child = new unpack_version(arguments);
			this.add(child);
			return child;
		}
	}
	
	for (var k in klasses) {
		for (var s in klasses) {
			augment(klasses[k], klasses[s], s);
		}
	}
	
	return {
		display_list : display_list
	}
})