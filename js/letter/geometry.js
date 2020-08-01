// basic geometry types to be reused across all other letter modules
// copyright 2020 Samuel Baird MIT Licence

// -- point --------------------------------------------------------------------
// basic 2d x,y position

class point {
	constructor (x, y) {
		this.x = x;
		this.y = y;
	}

	length () {
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	}

	distance (p) {
		const x = (p.x - this.x);
		const y = (p.y - this.y);
		return Math.sqrt((x * x) + (y * y));
	}
}

function point_distance (point1, point2) {
	const x = (point1.x - point2.x);
	const y = (point1.y - point2.y);
	return Math.sqrt((x * x) + (y * y));
}

// -- rect --------------------------------------------------------------------
// rect defined by x, y, width and height

class rect {
	constructor (x, y, width, height) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	expand (pad_x, pad_y) {
		this.x -= pad_x;
		this.y -= pad_y;
		this.width += (pad_x * 2);
		this.height += (pad_y * 2);
	}

	contains_point (p) {
		return (p.x >= this.x && p.y >= this.y && p.x <= this.x + this.width && p.y <= this.y + this.height);
	}

	expand_to_include_point (p) {
		if (p.x < this.x) {
			this.width = (this.x + this.width) - p.x;
			this.x = p.x;
		} else if (p.x > this.x + this.width) {
			this.width = p.x - this.x;
		}

		if (p.y < this.y) {
			this.height = (this.y + this.height) - p.y;
			this.y = p.y;
		} else if (p.y > this.y + this.height) {
			this.height = p.y - this.y;
		}
	}
}

function expanded_rect (r, pad_x, pad_y) {
	return new rect(r.x - pad_x, r.y - pad_x, r.width + (pad_x * 2), r.height + (pad_y * 2));
}

function combined_rect_and_point (r, p) {
	if (rect == null) {
		return new rect(p.x, p.y, 0, 0);
	}

	let x = r.x;
	let y = r.y;
	let width = r.width;
	let height = r.height;
	if (p.x < x) {
		width = (x + width) - p.x;
		x = p.x;
	} else if (p.x > x + width) {
		width = p.x - x;
	}

	if (p.y < y) {
		height = (y + height) - p.y;
		y = p.y;
	} else if (p.y > y + height) {
		height = p.y - y;
	}

	return new rect(x, y, width, height);
}

// -- transform --------------------------------------------------------------------
// 2d affine transform, but not defined using a matrix

class transform {
	constructor (x, y, scale_x, scale_y, rotation, alpha) {
		this.x = x;
		this.y = y;
		this.scale_x = scale_x;
		this.scale_y = scale_y;
		this.rotation = rotation;
		this.alpha = alpha;
	}

	static identity () {
		return new transform(0, 0, 1, 1, 0, 1);
	}

	multiply (t) {
		// special case for rotation
		if (this.rotation == 0) {
			return new transform(
				this.x + (this.scale_x * t.x),
				this.y + (this.scale_y * t.y),
				this.scale_x * t.scale_x,
				this.scale_y * t.scale_y,
				this.rotation + t.rotation,
				this.alpha * t.alpha
			);
		} else {
			const c = Math.cos(this.rotation);
			const s = Math.sin(this.rotation);
			return new transform(
				this.x + (this.scale_x * t.x * c) - (this.scale_y * t.y * s),
				this.y + (this.scale_y * t.y * c) + (this.scale_x * t.x * s),
				this.scale_x * t.scale_x,
				this.scale_y * t.scale_y,
				this.rotation + t.rotation,
				this.alpha * t.alpha
			);
		}
	}

	transform_point (p) {
		// special case for 0 rotation
		if (this.rotation == 0) {
			return new point(this.x + (this.scale_x * p.x), this.y + (this.scale_y * p.y));
		} else {
			const c = Math.cos(this.rotation);
			const s = Math.sin(this.rotation);
			return new point(
				this.x + (this.scale_x * p.x * c) - (this.scale_y * p.y * s),
				this.y + (this.scale_y * p.y * c) + (this.scale_x * p.x * s)
			);
		}
	}

	untransform_point (p) {
		// special case for 0 rotation
		if (this.rotation == 0) {
			return new point((p.x - this.x) / this.scale_x, (p.y - this.y) / this.scale_y);
		} else {
			const c = Math.cos(-this.rotation);
			const s = Math.sin(-this.rotation);
			const x = (p.x - this.x) / this.scale_x;
			const y = (p.y - this.y) / this.scale_y;
			return new point((this.scale_x * x * c) - (this.scale_y * y * s), (this.scale_y * y * c) - (this.scale_x * x * s));
		}
	}
}

const default_transform = transform.identity();

// -- color --------------------------------------------------------------------
// colour class to share and link to drawing commands, 0 - 1 rgba

class color {
	constructor (r, g, b, alpha) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.alpha = alpha;
	}

	fill_style () {
		return 'rgb(' + Math.floor(this.r * 255) + ',' + Math.floor(this.g * 255) + ',' + Math.floor(this.b * 255) + ')';
	}

	grey (grey_level) {
		return new color(grey_level, grey_level, grey_level, 1);
	}
}

color.white = new color(1, 1, 1, 1);
color.black = new color(0, 0, 0, 1);
color.clear = new color(0, 0, 0, 0);

// -- font --------------------------------------------------------------------
// font class to link to canvas drawing commands
// also provides measurement and line breaking

class font {
	constructor (ctx, size, name, align, baseline) {
		this.ctx = ctx;
		this.size = (size != undefined ? size : 11);
		this.name = (name != undefined ? name : 'sans-serif');
		this.align = (align != undefined ? align : 'start');
		this.baseline = (baseline != undefined ? baseline : 'middle');
		this.font = this.size + 'px ' + this.name;

		// measure the line height as soon as we can
		this.set();
		const measure = ctx.measureText('L');
		if (measure.emHeightDescent) {
			this.line_height = measure.emHeightDescent + measure.emHeightAscent;
		} else {
			this.line_height = size;
		}
	}

	set (ctx) {
		if (ctx == undefined) {
			ctx = this.ctx;
		}
		ctx.font = this.font;
		ctx.textAlign = this.align;
		ctx.textBaseline = this.baseline;
	}

	measure_string (str) {
		this.set();
		return this.ctx.measureText(str).width;
	}

	breaklines (text, word_wrap) {
		if (word_wrap == undefined || word_wrap == 0 || text == null) {
			return [text];
		} else {
			const lines = [];
			let current_line = '';
			let current_line_width = 0;
			let current_word = '';
			let current_word_width = 0;
			let last_word_count = 0;
			for (const char of text) {
				const can_break = (char === ' ' || char === '.' || char === '\t' || char === ',');
				const width = this.measure_string(char);

				if (current_line != '' && width + current_word_width + current_line_width > word_wrap) {
					// move to the next line
					lines.push(current_line.trim());
					current_line = '';
					current_line_width = 0;
					last_word_count = 0;
				}
				// add char to the current word
				current_word = current_word + char;
				current_word_width += width;
				if (can_break) {
					current_line = current_line + current_word;
					current_line_width += current_word_width;
					current_word = '';
					current_word_width = 0;
					last_word_count++;
				}
			}
			if (current_word != '') {
				current_line = current_line + current_word;
				last_word_count++;
			}
			if (current_line != '') {
				lines.push(current_line.trim());
			}

			// check for a hanging orphan line
			if (lines.length >= 2 && last_word_count == 1) {
				// see if we can steal a word from the previous line
				const previous_line = lines[lines.length - 2];
				let break_point = previous_line.length;
				while (break_point > 1) {
					break_point--;
					const char = previous_line.charAt(break_point);
					const can_break = (char === ' ' || char === '.' || char === '\t' || char === ',');
					if (can_break) {
						// check if a substitute works
						const new_last_line = previous_line.substr(break_point + 1) + ' ' + lines[lines.length - 1];
						if (this.measure_string(new_last_line) < word_wrap) {
							lines[lines.length - 1] = new_last_line;
							lines[lines.length - 2] = previous_line.substr(0, break_point);
						}
						break;
					}
				}
			}

			return lines;
		}
	}

	measure (text, word_wrap) {
		let x = 0;
		let y = 0;

		const lines = this.breaklines(text, word_wrap);
		const width = (lines.length == 1) ? this.measure_string(lines[0]) : word_wrap;
		const height = lines.length * this.line_height;

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
			padding : this.line_height * 0.5,
		};
	}
}

// -- image data --------------------------------------------------------------------
// define regions and sprites within larger textures, mostly for loading from external
// texture maps

class image_data {
	constructor (name, texture, xy, uv) {
		this.name = name;
		this.texture = texture;

		this.source_rect = rect(uv[0] * texture.width, uv[1] * texture.height, (uv[2] - uv[0]) * texture.width, (uv[3] - uv[1]) * texture.height);
		this.dest_rect = rect(xy[0], xy[1], xy[2] - xy[0], xy[3] - xy[1]);
	}

	bounds  () {
		return this.dest_rect;
	}
}

// -- animations data --------------------------------------------------------------------

// -- clip entry --------------------------------------------------------------------
// not exported, refers to the position of one child object within one frame of an animation

class clip_entry extends transform {
	constructor (instance_name, x, y, scale_x, scale_y, rotation, alpha) {
		super(
			(x !== undefined) ? x : 0,
			(y !== undefined) ? y : 0,
			(scale_x !== undefined) ? scale_y : 0,
			(scale_y !== undefined) ? scale_y : 0,
			(rotation !== undefined) ? rotation : 0,
			(alpha !== undefined) ? alpha : 0
		);
		this.instance_name = instance_name;
	}

	static image_data (instance_name, image_data, x, y, scale_x, scale_y, rotation, alpha) {
		const entry = clip_entry(instance_name, x, y, scale_x, scale_y, rotation, alpha);
		entry.image_data = image_data;
		return entry;
	}

	static clip_data (instance_name, clip_data, x, y, scale_x, scale_y, rotation, alpha, frame_no) {
		const entry = clip_entry(instance_name, x, y, scale_x, scale_y, rotation, alpha);
		entry.clip_data = clip_data;
		entry.frame_no = frame_no;
		return entry;
	}
}

// -- clip frame --------------------------------------------------------------------
// not exported, aggregate of all entries for a frame, and a label

class clip_frame {
	constructor (label) {
		this.label = label;
		this.content = [];
	}

	generate_instance_name (name, data) {
		let count = 1;
		for (const c of this.content) {
			if (c.image_data == data || c.clip_data == data) {
				count++;
			}
		}
		return '_' + name + '_' + count;
	}

	add_image_content (instance_name, image_data, x, y, scale_x, scale_y, rotation, alpha) {
		if (!instance_name) {
			instance_name = this.generate_instance_name('img_' + image_data.name, image_data);
		}
		const entry = clip_entry.image_data(image_data, x, y, scale_x, scale_y, rotation, alpha);
		this.content.push(entry);
		return this;
	}

	add_clip_content (instance_name, clip_data, x, y, scale_x, scale_y, rotation, alpha, frame_no) {
		if (!instance_name) {
			instance_name = this.generate_instance_name('img_' + clip_data.name, clip_data);
		}
		const entry = clip_entry.clip_data(instance_name, clip_data, x, y, scale_x, scale_y, rotation, alpha, frame_no);
		this.content.push(entry);
		return this;
	}
}

// -- clip data --------------------------------------------------------------------
// animation sequence, with nested clips

class clip_data {
	constructor (name) {
		this.name = name;
		this.frames = [];
		this.labels = new Map();
	}

	add_frame (label) {
		const frame = new clip_frame(label);
		this.frames.push(frame);
		return frame;
	}

	link_resources (resources) {
		// generate start and end points for all labels during this pass
		this.labels.set('all', { start_frame : 1, end_frame: this.frames.length });
		let tracking_label = null;
		let frame_no = 0;
		for (const frame of this.frames) {
			frame_no++;
			if (frame.label) {
				tracking_label = { start_frame : frame_no, end_frame : frame_no };
				this.labels.set(frame.label, tracking_label);
			} else if (tracking_label) {
				tracking_label.end_frame = frame_no;
			}

			// -- link image_data and clip_data objects directly
			for (const c of frame.content) {
				if (c.image_data && typeof c.image_data == 'string') {
					c.image_data = resources.get_image_data(c.image_data);
				}
				if (c.clip_data && typeof c.clip_data == 'string') {
					c.clip_data = resources.get_clip_data(c.clip_data);
				}
			}
		}
	}
}

export { point, rect, transform, default_transform, point_distance, expanded_rect, combined_rect_and_point, color, font, image_data, clip_data };