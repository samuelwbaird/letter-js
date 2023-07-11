// basic geometry types to be reused across all other letter modules
// copyright 2020 Samuel Baird MIT Licence

// -- point --------------------------------------------------------------------
// basic 2d x,y position

class Point {
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

function pointDistance (point1, point2) {
	const x = (point1.x - point2.x);
	const y = (point1.y - point2.y);
	return Math.sqrt((x * x) + (y * y));
}

// -- rect --------------------------------------------------------------------
// rect defined by x, y, width and height

class Rect {
	constructor (x, y, width, height) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	expand (padX, padY) {
		this.x -= padX;
		this.y -= padY;
		this.width += (padX * 2);
		this.height += (padY * 2);
	}

	containsPoint (p) {
		return (p.x >= this.x && p.y >= this.y && p.x <= this.x + this.width && p.y <= this.y + this.height);
	}

	expandToIncludePoint (p) {
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

function expandedRect (r, padX, padY) {
	return new Rect(r.x - padX, r.y - padX, r.width + (padX * 2), r.height + (padY * 2));
}

function combinedRectAndPoint (r, p) {
	if (r == null) {
		return new Rect(p.x, p.y, 0, 0);
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

	return new Rect(x, y, width, height);
}

// -- transform --------------------------------------------------------------------
// 2d affine transform, but not defined using a matrix

class Transform {
	constructor (x, y, scaleX, scaleY, rotation, alpha) {
		this.x = x;
		this.y = y;
		this.scaleX = scaleX;
		this.scaleY = scaleY;
		this.rotation = rotation;
		this.alpha = alpha;
	}

	static identity () {
		return new Transform(0, 0, 1, 1, 0, 1);
	}

	multiply (t) {
		const flipX = Math.sign(this.scaleX) != Math.sign(t.scaleX);
		const flipY = Math.sign(this.scaleY) != Math.sign(t.scaleY);
		const flipRotation = 1 * (flipX ? -1 : 1) * (flipY ? -1 : 1);

		// special case for rotation
		if (this.rotation == 0) {
			return new Transform(
				this.x + (this.scaleX * t.x),
				this.y + (this.scaleY * t.y),
				this.scaleX * t.scaleX,
				this.scaleY * t.scaleY,
				this.rotation + (t.rotation * flipRotation),
				this.alpha * t.alpha
			);
		} else {
			const c = Math.cos(this.rotation);
			const s = Math.sin(this.rotation);

			return new Transform(
				this.x + (this.scaleX * t.x * c) - (this.scaleY * t.y * s),
				this.y + (this.scaleY * t.y * c) + (this.scaleX * t.x * s),
				this.scaleX * t.scaleX,
				this.scaleY * t.scaleY,
				this.rotation + (t.rotation * flipRotation),
				this.alpha * t.alpha
			);
		}
	}

	transformPoint (p) {
		// special case for 0 rotation
		if (this.rotation == 0) {
			return new Point(this.x + (this.scaleX * p.x), this.y + (this.scaleY * p.y));
		} else {
			const c = Math.cos(this.rotation);
			const s = Math.sin(this.rotation);
			return new Point(
				this.x + (this.scaleX * p.x * c) - (this.scaleY * p.y * s),
				this.y + (this.scaleY * p.y * c) + (this.scaleX * p.x * s)
			);
		}
	}

	untransformPoint (p) {
		// special case for 0 rotation
		if (this.rotation == 0) {
			return new Point((p.x - this.x) / this.scaleX, (p.y - this.y) / this.scaleY);
		} else {
			const c = Math.cos(-this.rotation);
			const s = Math.sin(-this.rotation);
			const x = (p.x - this.x) / this.scaleX;
			const y = (p.y - this.y) / this.scaleY;
			return new Point((this.scaleX * x * c) - (this.scaleY * y * s), (this.scaleY * y * c) - (this.scaleX * x * s));
		}
	}
}

// -- color --------------------------------------------------------------------
// colour class to share and link to drawing commands, 0 - 1 rgba

class Color {
	constructor (r, g, b, alpha) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.alpha = alpha ?? 1;
	}

	fillStyle () {
		return 'rgb(' + Math.floor(this.r * 255) + ',' + Math.floor(this.g * 255) + ',' + Math.floor(this.b * 255) + ')';
	}

	static grey (greyLevel, alpha) {
		return new Color(greyLevel, greyLevel, greyLevel, alpha ? alpha : 1);
	}
}

Color.white = new Color(1, 1, 1, 1);
Color.black = new Color(0, 0, 0, 1);
Color.clear = new Color(0, 0, 0, 0);

// -- font --------------------------------------------------------------------
// font class to link to canvas drawing commands
// also provides measurement and line breaking

class Font {
	constructor (ctx, size, name, align = null, initValues = null) {
		this.ctx = ctx;
		this.size = (size != undefined ? size : 11);
		this.name = (name != undefined ? name : 'sans-serif');

		// init values could be in 4th or 5th place
		if (initValues == null && (typeof align != 'string')) {
			initValues = align;
			align = null;
		}

		// default values
		this.align = (align != undefined ? align : 'start');
		this.baseline = 'middle';
		this.font = this.size + 'px ' + this.name;
		this.bold = false;

		// override with init values
		if (initValues) {
			for (const k in initValues) {
				this[k] = initValues[k];
			}
		}

		// measure the line height as soon as we can
		this.set();
		const measure = ctx.measureText('L');
		if (measure.emHeightDescent) {
			this.lineHeight = measure.emHeightDescent + measure.emHeightAscent;
		} else {
			this.lineHeight = size;
		}
	}

	set (ctx) {
		if (ctx == undefined) {
			ctx = this.ctx;
		}
		ctx.font = (this.bold ? 'bold ' : ' ') + this.font;
		ctx.textAlign = this.align;
		ctx.textBaseline = this.baseline;
	}

	measureString (str) {
		this.set();
		return this.ctx.measureText(str).width;
	}

	breaklines (text, wordWrap) {
		if (wordWrap == undefined || wordWrap == 0 || text == null) {
			return [text];
		} else {
			const lines = [];
			let currentLine = '';
			let currentLineWidth = 0;
			let currentWord = '';
			let currentWordWidth = 0;
			let lastWordCount = 0;
			for (const char of text) {
				const canBreak = (char === ' ' || char === '.' || char === '\t' || char === ',');
				const width = this.measureString(char);

				if (char == '\n' || (currentLine != '' && width + currentWordWidth + currentLineWidth > wordWrap)) {
					// move to the next line
					lines.push(currentLine.trim());
					currentLine = '';
					currentLineWidth = 0;
					lastWordCount = 0;
				}
				// add char to the current word (unless that word is longer than word wrap)
				if (currentWordWidth < wordWrap) {
					currentWord = currentWord + char;
					currentWordWidth += width;
				}
				if (canBreak) {
					currentLine = currentLine + currentWord;
					currentLineWidth += currentWordWidth;
					currentWord = '';
					currentWordWidth = 0;
					lastWordCount++;
				}
			}
			if (currentWord != '') {
				currentLine = currentLine + currentWord;
				lastWordCount++;
			}
			if (currentLine != '') {
				lines.push(currentLine.trim());
			}

			// check for a hanging orphan line
			if (lines.length >= 2 && lastWordCount == 1) {
				// see if we can steal a word from the previous line
				const previousLine = lines[lines.length - 2];
				let breakPoint = previousLine.length;
				while (breakPoint > 1) {
					breakPoint--;
					const char = previousLine.charAt(breakPoint);
					const canBreak = (char === ' ' || char === '.' || char === '\t' || char === ',');
					if (canBreak) {
						// check if a substitute works
						const newLastLine = previousLine.substr(breakPoint + 1) + ' ' + lines[lines.length - 1];
						if (this.measureString(newLastLine) < wordWrap) {
							lines[lines.length - 1] = newLastLine;
							lines[lines.length - 2] = previousLine.substr(0, breakPoint);
						}
						break;
					}
				}
			}

			return lines;
		}
	}

	measure (text, wordWrap) {
		let x = 0;
		let y = 0;

		const lines = this.breaklines(text, wordWrap);
		const width = (lines.length == 1) ? this.measureString(lines[0]) : wordWrap;
		const height = lines.length * this.lineHeight;

		// TODO: adjust for baseline and hanging
		y -= this.lineHeight * 0.5;

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
			lineHeight : this.lineHeight,
			padding : this.lineHeight * 0.5,
		};
	}
}

// -- image data --------------------------------------------------------------------
// define regions and sprites within larger textures, mostly for loading from external
// texture maps

class ImageData {
	constructor (name, texture, xy, uv) {
		this.name = name;
		this.texture = texture;

		this.sourceRect = new Rect(uv[0] * texture.width, uv[1] * texture.height, (uv[2] - uv[0]) * texture.width, (uv[3] - uv[1]) * texture.height);
		this.destRect = new Rect(xy[0], xy[1], xy[2] - xy[0], xy[3] - xy[1]);
	}

	bounds () {
		return this.destRect;
	}

	expandForTiling (amount = 0.1) {
		this.sourceRect.expand(-amount, -amount);
		this.destRect.expand(amount, amount);
	}
}

// -- animations data --------------------------------------------------------------------

// -- clip entry --------------------------------------------------------------------
// not exported, refers to the position of one child object within one frame of an animation

class ClipEntry extends Transform {
	constructor (instanceName, x, y, scaleX, scaleY, rotation, alpha) {
		super(
			(x !== undefined) ? x : 0,
			(y !== undefined) ? y : 0,
			(scaleX !== undefined) ? scaleY : 0,
			(scaleY !== undefined) ? scaleY : 0,
			(rotation !== undefined) ? rotation : 0,
			(alpha !== undefined) ? alpha : 0
		);
		this.instanceName = instanceName;
	}

	static imageData (instanceName, imageData, x, y, scaleX, scaleY, rotation, alpha) {
		const entry = new ClipEntry(instanceName, x, y, scaleX, scaleY, rotation, alpha);
		entry.imageData = imageData;
		return entry;
	}

	static clipData (instanceName, clipData, x, y, scaleX, scaleY, rotation, alpha, frameNO) {
		const entry = new ClipEntry(instanceName, x, y, scaleX, scaleY, rotation, alpha);
		entry.clipData = clipData;
		entry.frameNO = frameNO;
		return entry;
	}

	static displayListData (instanceName, x, y, scaleX, scaleY, rotation, alpha) {
		return new ClipEntry(instanceName, x, y, scaleX, scaleY, rotation, alpha);
	}
}

// -- clip frame --------------------------------------------------------------------
// not exported, aggregate of all entries for a frame, and a label

class ClipFrame {
	constructor (label) {
		this.label = label;
		this.content = [];
	}

	generateInstanceName (name, data) {
		let count = 1;
		for (const c of this.content) {
			if (c.imageData == data || c.clipData == data) {
				count++;
			}
		}
		return '_' + name + '_' + count;
	}

	addImageContent (instanceName, imageData, x, y, scaleX, scaleY, rotation, alpha) {
		if (!instanceName) {
			instanceName = this.generateInstanceName('img_' + imageData.name, imageData);
		}
		const entry = ClipEntry.imageData(instanceName, imageData, x, y, scaleX, scaleY, rotation, alpha);
		this.content.push(entry);
		return this;
	}

	addClipContent (instanceName, clipData, x, y, scaleX, scaleY, rotation, alpha, frameNO) {
		if (!instanceName) {
			instanceName = this.generateInstanceName('img_' + clipData.name, clipData);
		}
		const entry = ClipEntry.clipData(instanceName, clipData, x, y, scaleX, scaleY, rotation, alpha, frameNO);
		this.content.push(entry);
		return this;
	}

	addDisplayListContent (instanceName, x, y, scaleX, scaleY, rotation, alpha) {
		if (!instanceName) {
			throw 'cannot add display list to frame data without instance name';
		}
		const entry = ClipEntry.displayListData(instanceName, x, y, scaleX, scaleY, rotation, alpha);
		this.content.push(entry);
		return this;
	}
}

// -- clip data --------------------------------------------------------------------
// animation sequence, with nested clips

class ClipData {
	constructor (name) {
		this.name = name;
		this.frames = [];
		this.labels = new Map();
	}

	addFrame (label) {
		const frame = new ClipFrame(label);
		this.frames.push(frame);
		return frame;
	}

	linkResource (resource, alertONError) {
		// generate start and end points for all labels during this pass
		this.labels.set('all', { startFrame : 1, endFrame: this.frames.length });
		let trackingLabel = null;
		let frameNO = 0;
		for (const frame of this.frames) {
			frameNO++;
			if (frame.label) {
				trackingLabel = { startFrame : frameNO, endFrame : frameNO };
				this.labels.set(frame.label, trackingLabel);
			} else if (trackingLabel) {
				trackingLabel.endFrame = frameNO;
			}

			// -- link imageData and clipData objects directly
			for (const c of frame.content) {
				if (c.imageData && typeof c.imageData == 'string') {
					const id = resource.getImageData(c.imageData);
					if (id) {
						c.imageData = id;
					} else if (alertONError) {
						alert('missing image data ' + c.imageData);
					}
				}
				if (c.clipData && typeof c.clipData == 'string') {
					const cd = resource.getClipData(c.clipData);
					if (cd) {
						c.clipData = cd;
					} else if (alertONError) {
						alert('missing clip data ' + c.clipData);
					}
				}
			}
		}
	}
}

export { Point, Rect, Transform, pointDistance, expandedRect, combinedRectAndPoint, Color, Font, ImageData, ClipData };
