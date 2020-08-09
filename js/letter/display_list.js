// implements a range of AS3 style display list classes, rendering into a 2D canvas context
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from  './geometry.js';
import * as resources from './resources.js';

class display_list extends geometry.transform {
	constructor (init_values) {
		super(0, 0, 1, 1, 0, 1);
		// this.name = null;
		// this.parent = null;
		// this.children = null;

		this.visible = true;

		if (init_values) {
			for (const k in init_values) {
				this[k] = init_values[k];
			}
		}
	}

	// -- manage children ------------

	get_children () {
		if (!this.children) {
			this.children = [];
		}
		return this.children;
	}

	add (display) {
		if (display.parent) {
			display.remove_from_parent();
		}
		this.get_children().push(display);
		display.parent = this;
	}

	add_at_index (display, index) {
		if (display.parent) {
			display.remove_from_parent();
		}
		this.get_children().splice(index, 0, display);
		display.parent = this;
	}

	send_to_front (display) {
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

	send_to_back (display) {
		if (display) {
			this.add_at_index(display, 0);
		} else if (this.parent) {
			this.parent.send_to_back(this);
		}
	}

	remove (display) {
		if (display.parent == this) {
			const index = this.children.indexOf(display);
			this.children.splice(index, 1);
			display.parent = null;
		}
	}

	remove_from_parent () {
		if (this.parent) {
			this.parent.remove(this);
		}
	}

	remove_all_children () {
		if (this.children) {
			for (const child of this.children) {
				child.parent = null;
			}
			this.children = null;
		}
	}

	// -- transforms -----------------

	transform () {
		return this;	// assume I'm going to regret this at some point...
	}

	world_transform () {
		if (this.parent) {
			return this.parent.world_transform().multiply(this);
		} else {
			return this;
		}
	}

	local_to_world (point) {
		return this.world_transform().transform_point(point);
	}

	world_to_local (point) {
		return this.world_transform().untransform_point(point);
	}

	// -- bounds ----------------------

	bounds (reference) {
		// starting point
		let rect = this.frozen_bounds;
		if (rect == null) {
			rect = this.content_bounds();
			// expand to fit children
			if (this.children) {
				for (const child of this.children) {
					const sub_rect = child.bounds();
					if (sub_rect) {
						// all points of the bound transformed
						const points = [
							child.transform_point(new geometry.point(sub_rect.x, sub_rect.y)),
							child.transform_point(new geometry.point(sub_rect.x + sub_rect.width, sub_rect.y)),
							child.transform_point(new geometry.point(sub_rect.x, sub_rect.y + sub_rect.height)),
							child.transform_point(new geometry.point(sub_rect.x + sub_rect.width, sub_rect.y + sub_rect.height)),
						];
						for (let j = 0; j < 4; j++) {
							rect = geometry.combined_rect_and_point(rect, points[j]);
						}
					}
				}
			}
		}
		// convert to requested reference point
		if (!rect || !reference) {
			return rect;
		} else {
			const world = this.world_transform();
			const points = [
				world.untransform_point(new geometry.point(rect.x, rect.y)),
				world.untransform_point(new geometry.point(rect.x + rect.width, rect.y)),
				world.untransform_point(new geometry.point(rect.x, rect.y + rect.height)),
				world.untransform_point(new geometry.point(rect.x + rect.width, rect.y + rect.height)),
			];
			const ref = reference.world_transform();
			for (let j = 0; j < 4; j++) {
				rect = geometry.combined_rect_and_point(rect, geometry.untransform_point(ref, points[j]));
			}
			return rect;
		}
	}

	content_bounds () {
		// get bounds without any reference point
		// derived classes should implement only this method
		return null;
	}

	is_visible () {
		if (!this.visible || this.alpha < 0.01) {
			return false;
		}

		if (this.parent) {
			return this.parent.is_visible();
		}

		return true;
	}

	// -- cache/freeze as bitmap ------------------------

	// display.freeze_fast freeze to image_data that is rendered using image_data instead of as a canvas

	freeze (optional_bounds, scale_factor) {
		if (optional_bounds == undefined) {
			optional_bounds = this.bounds();
		}
		if (scale_factor == undefined) {
			scale_factor = 1;
		}

		this.frozen_bounds = optional_bounds;
		let temporary_ctx = null;
		const required_width = this.frozen_bounds.width * scale_factor;
		const required_height = this.frozen_bounds.height * scale_factor;

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

		const transform = geometry.default_transform;

		transform.x = -this.frozen_bounds.x * scale_factor;
		transform.y = -this.frozen_bounds.y * scale_factor;
		transform.scale_x = transform.scale_y = scale_factor;
		if (this.content_render) {
			this.content_render(temporary_ctx, transform);
		}
		if (this.children) {
			for (const child of this.children) {
				child.render(temporary_ctx, transform);
			}
		}

		// this.frozen_image_data = temporary_ctx.getImageData(0, 0, this.frozen_bounds.width, this.frozen_bounds.height);
		this.is_frozen = true;
	}

	unfreeze () {
		this.is_frozen = false;
		this.frozen_image_canvas = null;
		this.frozen_bounds = null;
	}

	// -- render -----------------------------------------

	update_animated_clips (delta, add_oncomplete_callback) {
		if (this.update) {
			this.update(delta, add_oncomplete_callback);
		}
		if (this.children) {
			for (const child of this.children) {
				child.update_animated_clips(delta, add_oncomplete_callback);
			}
		}
	}

	render (ctx, with_transform) {
		if (!this.visible || this.alpha == 0) {
			return;
		}

		// transform within parent
		const transform = with_transform.multiply(this);
		if (transform.alpha < 0.001) {
			return;
		}

		if (this.is_frozen) {
			ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
			ctx.scale(transform.scale_x, transform.scale_y);
			ctx.globalAlpha = transform.alpha;
			ctx.drawImage(this.frozen_image_canvas, 0, 0, this.frozen_image_canvas.width, this.frozen_image_canvas.height,
				this.frozen_bounds.x, this.frozen_bounds.y, this.frozen_bounds.width, this.frozen_bounds.height);
			ctx.restore();

		} else {
			if (this.content_render) {
				this.content_render(ctx, transform);
			}
			if (this.children) {
				for (const child of this.children) {
					child.render(ctx, transform);
				}
			}
		}
	}

	// -- override / customise for different display object types ------------

	// display_list.update = function (delta) {} // update animations
	// display_list.content_render = function (ctx, transform) {} // render actual content at this level with the given transform
}

// -- derived type rendering an image

class image extends display_list {

	constructor (image_data_or_name, init_values) {
		super(init_values);

		if (typeof image_data_or_name == 'string') {
			this.image_data = resources.get_image_data(image_data_or_name);
		} else {
			this.image_data = image_data_or_name;
		}
	}

	content_render (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scale_x, transform.scale_y);
		ctx.globalAlpha = transform.alpha;
		const src = this.image_data.source_rect;
		const dst = this.image_data.dest_rect;
		ctx.drawImage(this.image_data.texture, src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height);
		ctx.restore();
	}

	content_bounds () {
		return this.image_data.bounds();
	}

}

// -- derived type rendering an image

class clip extends display_list {

	constructor (clip_data_or_name, init_values) {
		super(init_values);
		this.children = [];

		if (typeof clip_data_or_name == 'string') {
			this.clip_data = resources.get_clip_data(clip_data_or_name);
		} else {
			this.clip_data = clip_data_or_name;
		}

		this.playback_speed = 1;
		this.playback_position = 1;

		this.is_playing = false;
		this.start_frame = 1;
		this.end_frame = this.clip_data.frames.length;
		this.loop = true;

		this.current_frame = null;
		this.set_frame(this.clip_data.frames[0]);
	}

	stop () {
		this.is_playing = false;
	}

	play (arg1, arg2, arg3, arg4) {
		this.is_playing = true;
		this.on_complete = null;

		let label_was_set = false;
		let loop_was_set = false;
		let on_complete_was_set = false;

		const args = [arg1, arg2, arg3, arg4];
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			if (typeof arg == 'boolean') {
				loop_was_set = true;
				this.loop = arg;
			} else if (typeof arg == 'string') {
				if (label_was_set) {
					throw 'only one label string argument is allowed';
				} else {
					if (!loop_was_set) {
						this.loop = false;
					}
					const frames = this.clip_data.labels.get(arg);
					if (!frames) {
						throw 'unknown frame ' + arg + ' in clip ' + this.clip_data.name;
					}
					this.start_frame = frames.start_frame;
					this.end_frame = frames.end_frame;
					this.playback_position = this.start_frame;
					label_was_set = true;
				}
			} else if (typeof arg == 'function') {
				if (on_complete_was_set) {
					throw 'only one on_complete function argument is allowed';
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

	goto (label_or_number) {
		if (typeof label_or_number == 'number') {
			this.start_frame = label_or_number;
			this.end_frame = label_or_number;
		} else {
			const frames = this.clip_data.labels.get(label_or_number);
			if (!frames) {
				throw 'unknown frame ' + label_or_number + ' in clip ' + this.clip_data.name;
			}
			this.start_frame = frames.start_frame;
			this.end_frame = frames.start_frame;
		}

		this.is_playing = false;
		this.set_frame(this.clip_data.frames[this.start_frame - 1]);
	}

	update (delta, add_oncomplete_callback) {
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

		const frame = this.clip_data.frames[Math.floor(this.playback_position) - 1];
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

	set_frame (frame) {
		if (!frame) {
			throw 'setting invalid frame';
		}
		this.current_frame = frame;

		// -- retain a list of current content (re-use objects where they match)
		const current = new Map();
		for (const [index, child] of this.children.entries()) {
			if (child.name) {
				current.set(child.name, child);
			} else {
				current.set('__' + index, child);
			}
		}

		// -- recreate the child display list, re-using objects
		for (const [index, content] of frame.content.entries()) {
			let child = current.get(content.instance_name);
			if (child) {
				// -- move it to the correct index
				this.children[index] = child;
				// -- make sure this is not removed later
				current.delete(content.instance_name);
			} else {
				// -- create a new child clip
				if (content.image_data) {
					child = new image(content.image_data);
				} else if (content.clip_data) {
					child = new clip.constructor(content.clip_data);
					// -- if frame is not specified then the sub clip should play
					if (!content.frame_no) {
						child.play();
					}
				} else {
					throw 'unknown content type in animation';
				}
				child.parent = this;
				this.children[index] = child;
			}

			// -- apply the new transform
			child.x = content.x;
			child.y = content.y;
			child.scale_x = content.scale_x;
			child.scale_y = content.scale_y;
			child.rotation = content.rotation;
			child.alpha = content.alpha;
			if (content.frame_no) {
				child.goto_and_stop(content.frame_no);
			}
		}

		// -- trim extra child references
		this.children.splice(frame.content.length);
		for (const child of current.values()) {
			child.parent = null;
		}
	}
}

// -- derived type rendering a rectangle

class rect extends display_list {

	constructor (width, height, color, init_values) {
		super(init_values);
		this.width = width;
		this.height = height;
		this.color = color;
	}

	content_render (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scale_x, transform.scale_y);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		ctx.fillStyle = this.color.fill_style();
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.restore();
	}

	content_bounds () {
		return { x : 0, y : 0, width : this.width, height : this.height };
	}

}

class circle extends display_list {
	constructor (radius, color, init_values) {
		super(init_values);
		this.radius = radius;
		this.color = color;
	}

	content_render (ctx, transform) {
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

	content_bounds () {
		return { x : -this.radius, y : -this.radius, width : this.radius * 2, height : this.radius * 2 };
	}
}

class canvas extends display_list {
	constructor (bounds, on_render, init_values) {
		super(init_values);
		this.bounds = bounds;
		this.on_render = on_render;
	}

	content_render (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scale_x, transform.scale_y);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		this.on_render(ctx);
		ctx.restore();
	}

	content_bounds () {
		return this.bounds;
	}
}

class label extends display_list {
	constructor (font, text, color, init_values) {
		super(init_values);

		// TODO: set word_wrap to a number to wrap lines at a maximum length
		this.word_wrap = undefined;
		this.vertical_align = 'center';

		this.font = font;
		this.text = text;
		this.color = (color != undefined ? color : geometry.color.black);

		this.last_break = null;
		this.last_lines = null;
	}

	content_render (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scale_x, transform.scale_y);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		ctx.fillStyle = this.color.fill_style();
		this.font.set(ctx);

		const tx = 0;
		let ty = 0;
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
			const this_break = this.word_wrap + ':' + this.text;
			let lines = this.last_lines;
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

			for (const line of lines) {
				ctx.fillText(line, tx, ty);
				ty += this.font.line_height;
			}
		}
		ctx.restore();
	}

	content_bounds () {
		const font_bounds = this.font.measure(this.text, this.word_wrap);
		const bounds = geometry.expanded_rect(font_bounds, font_bounds.padding, font_bounds.padding);

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
}

// set up add methods from each class to each other class
const class_list = {
	'display_list' : display_list,
	'image' : image,
	'clip' : clip,
	'rect' : rect,
	'circle' : circle,
	'canvas' : canvas,
	'label' : label,
};

for (const this_class_name in class_list) {
	const this_class = class_list[this_class_name];
	for (const other_class_name in class_list) {
		const other_class = class_list[other_class_name];
		this_class.prototype['add_' + other_class_name] = function () {
			const child = new other_class(...arguments);
			this.add(child);
			return child;
		};
	}
}

export default display_list;
