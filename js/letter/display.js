// implements a range of AS3 style display list classes, rendering into a 2D canvas context
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from  './geometry.js';
import * as resource from './resource.js';

let defaultFreezeScale = 1;
function setDefaultFreezeScale (scale) {
	defaultFreezeScale = scale;
}

class DisplayList extends geometry.Transform {
	constructor (initValues) {
		super(0, 0, 1, 1, 0, 1);
		// this.name = null;
		// this.parent = null;
		// this.children = null;
		// this.visibilityTest = null;

		this.visible = true;

		if (initValues) {
			for (const k in initValues) {
				this[k] = initValues[k];
			}
		}
	}

	// -- manage children ------------

	getChildren () {
		if (!this.children) {
			this.children = [];
		}
		return this.children;
	}

	getChild (name) {
		if (this.children) {
			for (const child of this.children) {
				if (child.name == name) {
					return child;
				}
			}
		}
		return null;
	}

	add (display) {
		if (display.parent) {
			display.removeFromParent();
		}
		this.getChildren().push(display);
		display.parent = this;
		return display;
	}

	addATIndex (display, index) {
		if (display.parent) {
			display.removeFromParent();
		}
		this.getChildren().splice(index, 0, display);
		display.parent = this;
	}

	sendToFront (display) {
		if (display) {
			if (display.parent) {
				display.removeFromParent();
			}
			this.getChildren().push(display);
			display.parent = this;
		} else if (this.parent) {
			this.parent.sendToFront(this);
		}
	}

	sendToBack (display) {
		if (display) {
			this.addATIndex(display, 0);
		} else if (this.parent) {
			this.parent.sendToBack(this);
		}
	}

	remove (display) {
		if (display.parent == this) {
			const index = this.children.indexOf(display);
			this.children.splice(index, 1);
			display.parent = null;
		}
	}

	removeFromParent () {
		if (this.parent) {
			this.parent.remove(this);
		}
	}

	removeAllChildren () {
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

	worldTransform () {
		if (this.parent) {
			return this.parent.worldTransform().multiply(this);
		} else {
			return this;
		}
	}

	localToWorld (point) {
		return this.worldTransform().transformPoint(point);
	}

	worldToLocal (point) {
		return this.worldTransform().untransformPoint(point);
	}

	// -- bounds ----------------------

	bounds (reference) {
		// starting point
		let rect = this.frozenBounds;
		if (rect == null) {
			rect = this.contentBounds();
			// expand to fit children
			if (this.children) {
				for (const child of this.children) {
					const subRect = child.bounds();
					if (subRect) {
						// all points of the bound transformed
						const points = [
							child.transformPoint(new geometry.Point(subRect.x, subRect.y)),
							child.transformPoint(new geometry.Point(subRect.x + subRect.width, subRect.y)),
							child.transformPoint(new geometry.Point(subRect.x, subRect.y + subRect.height)),
							child.transformPoint(new geometry.Point(subRect.x + subRect.width, subRect.y + subRect.height)),
						];
						for (let j = 0; j < 4; j++) {
							rect = geometry.combinedRectAndPoint(rect, points[j]);
						}
					}
				}
			}
		}
		// convert to requested reference point
		if (!rect || !reference) {
			return rect;
		} else {
			const world = this.worldTransform();
			const points = [
				world.untransformPoint(new geometry.Point(rect.x, rect.y)),
				world.untransformPoint(new geometry.Point(rect.x + rect.width, rect.y)),
				world.untransformPoint(new geometry.Point(rect.x, rect.y + rect.height)),
				world.untransformPoint(new geometry.Point(rect.x + rect.width, rect.y + rect.height)),
			];
			const ref = reference.worldTransform();
			for (let j = 0; j < 4; j++) {
				rect = geometry.combinedRectAndPoint(rect, ref.untransformPoint(ref, points[j]));
			}
			return rect;
		}
	}

	contentBounds () {
		// get bounds without any reference point
		// derived classes should implement only this method
		return null;
	}

	isVisible () {
		if (!this.visible || this.alpha < 0.01) {
			return false;
		}

		if (this.parent) {
			return this.parent.isVisible();
		}

		return true;
	}

	// -- cache/freeze as bitmap ------------------------

	// display.freezeFast freeze to imageData that is rendered using imageData instead of as a canvas

	freeze (optionalBounds, scaleFactor) {
		if (optionalBounds == undefined) {
			optionalBounds = this.bounds();
		}
		if (scaleFactor == undefined) {
			scaleFactor = defaultFreezeScale;
		}

		this.frozenBounds = optionalBounds;
		let temporaryCtx = null;
		const requiredWidth = this.frozenBounds.width * scaleFactor;
		const requiredHeight = this.frozenBounds.height * scaleFactor;

		if (this.frozenImageCanvas == null || this.frozenImageCanvas.width != requiredWidth || this.frozenImageCanvas.height != requiredHeight) {
			// new or different size
			this.frozenImageCanvas = document.createElement('canvas');
			this.frozenImageCanvas.width = requiredWidth;
			this.frozenImageCanvas.height = requiredHeight;
			temporaryCtx = this.frozenImageCanvas.getContext('2d');
		} else {
			// clear and re-use
			temporaryCtx = this.frozenImageCanvas.getContext('2d');
			temporaryCtx.clearRect(0, 0, this.frozenImageCanvas.width, this.frozenImageCanvas.height);
		}

		const transform = geometry.Transform.identity();

		transform.x = -this.frozenBounds.x * scaleFactor;
		transform.y = -this.frozenBounds.y * scaleFactor;
		transform.scaleX = transform.scaleY = scaleFactor;
		if (this.contentRender) {
			this.contentRender(temporaryCtx, transform);
		}
		if (this.children) {
			for (const child of this.children) {
				child.render(temporaryCtx, transform);
			}
		}

		// this.frozenImageData = temporaryCtx.getImageData(0, 0, this.frozenBounds.width, this.frozenBounds.height);
		this.isFrozen = true;
	}

	unfreeze () {
		this.isFrozen = false;
		this.frozenImageCanvas = null;
		this.frozenBounds = null;
	}

	// -- render -----------------------------------------

	updateAnimatedClips (delta, addOncompleteCallback) {
		if (this.update) {
			this.update(delta, addOncompleteCallback);
		}
		if (this.children) {
			for (const child of this.children) {
				child.updateAnimatedClips(delta, addOncompleteCallback);
			}
		}
	}

	render (ctx, withTransform) {
		if (!this.visible || this.alpha == 0) {
			return;
		}

		// transform within parent
		const transform = withTransform.multiply(this);
		if (transform.alpha < 0.001) {
			return;
		}

		// TODO: if this.visibilityTest, then check this test against screen bounds before continuing

		if (this.isFrozen) {
			ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
			ctx.scale(transform.scaleX, transform.scaleY);
			ctx.globalAlpha = transform.alpha;
			ctx.drawImage(this.frozenImageCanvas, 0, 0, this.frozenImageCanvas.width, this.frozenImageCanvas.height,
				this.frozenBounds.x, this.frozenBounds.y, this.frozenBounds.width, this.frozenBounds.height);
			ctx.restore();

		} else {
			if (this.contentRender) {
				this.contentRender(ctx, transform);
			}
			if (this.children) {
				for (const child of this.children) {
					child.render(ctx, transform);
				}
			}
		}
	}

	// TODO: setVisibiltyTestFromCurrentBounds()
	// create a visibilty test function based on the current content bounds of this display list, + optional padding

	// -- override / customise for different display object types ------------

	// displayList.update = function (delta) {} // update animations
	// displayList.contentRender = function (ctx, transform) {} // render actual content at this level with the given transform
}

// -- derived type rendering an image

class Image extends DisplayList {

	constructor (imageDataOrName, initValues) {
		super(initValues);
		this.setImage(imageDataOrName);
	}

	setImage (imageDataOrName) {
		if (typeof imageDataOrName == 'string') {
			this.imageData = resource.getImageData(imageDataOrName);
			if (!this.imageData) {
				console.log('did not find image ' + imageDataOrName);
			}
		} else {
			this.imageData = imageDataOrName;
		}
	}

	contentRender (ctx, transform) {
		if (this.imageData) {
			ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
			ctx.scale(transform.scaleX, transform.scaleY);
			ctx.globalAlpha = transform.alpha;
			const src = this.imageData.sourceRect;
			const dst = this.imageData.destRect;
			ctx.drawImage(this.imageData.texture, src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height);
			ctx.restore();
		}
	}

	contentBounds () {
		return this.imageData.bounds();
	}

}

// -- derived type rendering an image

class Clip extends DisplayList {

	constructor (clipDataOrName, initValues) {
		super(initValues);
		this.children = [];

		if (typeof clipDataOrName == 'string') {
			this.clipData = resource.getClipData(clipDataOrName);
		} else {
			this.clipData = clipDataOrName;
		}

		this.playbackSpeed = 1;
		this.playbackPosition = 1;

		this.isPlaying = false;
		this.startFrame = 1;
		this.endFrame = this.clipData.frames.length;
		this.loop = true;

		this.currentFrame = null;
		this.setFrame(this.clipData.frames[0]);
	}

	stop () {
		this.isPlaying = false;
	}

	play (arg1, arg2, arg3, arg4) {
		this.isPlaying = true;
		this.onComplete = null;

		let labelWasSet = false;
		let loopWasSet = false;
		let onCompleteWasSet = false;

		const args = [arg1, arg2, arg3, arg4];
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			if (typeof arg == 'boolean') {
				loopWasSet = true;
				this.loop = arg;
			} else if (typeof arg == 'string') {
				if (labelWasSet) {
					throw 'only one label string argument is allowed';
				} else {
					if (!loopWasSet) {
						this.loop = false;
					}
					const frames = this.clipData.labels.get(arg);
					if (!frames) {
						throw 'unknown label ' + arg + ' in clip ' + this.clipData.name;
					}
					this.startFrame = frames.startFrame;
					this.endFrame = frames.endFrame;
					this.playbackPosition = this.startFrame;
					labelWasSet = true;
				}
			} else if (typeof arg == 'function') {
				if (onCompleteWasSet) {
					throw 'only one onComplete function argument is allowed';
				}
				if (!loopWasSet) {
					this.loop = false;
				}
				this.onComplete = arg;
				onCompleteWasSet = true;
			}

		}
		// -- check for start and end labels specified as numbers
		if (typeof arg1 == 'number' && typeof arg2 == 'number') {
			if (labelWasSet) {
				throw 'cannot set a label and frame numbers';
			}
			this.startFrame = arg1;
			this.endFrame = arg2;
		}

		if (this.loop && this.onComplete) {
			throw 'on_complete will not be used with looping animation';
		}
	}

	goto (labelOrNumber) {
		if (typeof labelOrNumber == 'number') {
			this.startFrame = labelOrNumber;
			this.endFrame = labelOrNumber;
		} else {
			const frames = this.clipData.labels.get(labelOrNumber);
			if (!frames) {
				throw 'unknown frame ' + labelOrNumber + ' in clip ' + this.clipData.name;
			}
			this.startFrame = frames.startFrame;
			this.endFrame = frames.startFrame;
		}

		this.isPlaying = false;
		this.setFrame(this.clipData.frames[this.startFrame - 1]);
	}

	update (delta, addOncompleteCallback) {
		if (!this.isPlaying) {
			return;
		}

		this.playbackPosition += this.playbackSpeed;
		if (Math.floor(this.playbackPosition) > this.endFrame) {
			if (this.loop) {
				while (Math.floor(this.playbackPosition) > this.endFrame) {
					this.playbackPosition -= (this.endFrame - this.startFrame) + 1;
				}
			} else {
				this.playbackPosition = this.endFrame;
				this.isPlaying = false;
			}
		}

		const frame = this.clipData.frames[Math.floor(this.playbackPosition) - 1];
		if (frame != this.currentFrame) {
			this.setFrame(frame);
		}

		if (!this.isPlaying) {
			if (this.onComplete) {
				addOncompleteCallback(this.onComplete);
				this.onComplete = null;
			}
		}
	}

	setFrame (frame) {
		if (!frame) {
			throw 'setting invalid frame';
		}
		this.currentFrame = frame;

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
			let child = current.get(content.instanceName);

			// check if types match before re-using an existing
			if (child) {
				if (content.imageData) {
					if (child.imageData != content.imageData) {
						child = null;
					}
				} else if (content.clipData) {
					if (child.clipData != content.clipData) {
						child = null;
					}
				}
			}

			// re-use existing
			if (child) {
				// -- move it to the correct index
				this.children[index] = child;
				// -- make sure this is not removed later
				current.delete(content.instanceName);
			} else {
				// -- create a new child clip
				if (content.imageData) {
					child = new Image(content.imageData);
				} else if (content.clipData) {
					child = new Clip(content.clipData);
					// -- if frame is not specified then the sub clip should play
					if (!content.frameNO) {
						child.play();
					}
				} else {
					// defaults to empty display list
					child = new DisplayList();
				}
				child.name = content.instanceName;
				child.parent = this;
				this.children[index] = child;
			}

			// -- apply the new Transform
			child.x = content.x;
			child.y = content.y;
			child.scaleX = content.scaleX;
			child.scaleY = content.scaleY;
			child.rotation = content.rotation;
			child.alpha = content.alpha;
			if (content.frameNO) {
				child.gotoAndStop(content.frameNO);
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

class Rect extends DisplayList {

	constructor (width, height, color, initValues) {
		super(initValues);
		this.width = width;
		this.height = height;
		this.color = color;
	}

	contentRender (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scaleX, transform.scaleY);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		ctx.fillStyle = this.color.fillStyle();
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.restore();
	}

	contentBounds () {
		return { x : 0, y : 0, width : this.width, height : this.height };
	}

}

class Circle extends DisplayList {
	constructor (radius, color, initValues) {
		super(initValues);
		this.radius = radius;
		this.color = color;
	}

	contentRender (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scaleX, transform.scaleY);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		ctx.fillStyle = this.color.fillStyle();
		ctx.beginPath();
		ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	contentBounds () {
		return { x : -this.radius, y : -this.radius, width : this.radius * 2, height : this.radius * 2 };
	}
}

class Canvas extends DisplayList {
	constructor (bounds, onRender, initValues) {
		super(initValues);
		this.bounds = bounds;
		this.onRender = onRender;
	}

	contentRender (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scaleX, transform.scaleY);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		this.onRender(ctx);
		ctx.restore();
	}

	contentBounds () {
		return this.bounds;
	}
}

class Label extends DisplayList {
	constructor (font, text, color, initValues) {
		super(initValues);

		// set wordWrap to a number to wrap lines at a maximum length
		// this.wordWrap = undefined;
		this.verticalAlign = (this.verticalAlign != null ? this.verticalAlign : 'center');

		this.font = font;
		this.text = text;
		this.color = (color != undefined ? color : geometry.Color.black);

		this.lastBreak = null;
		this.lastLines = null;
	}

	contentRender (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scaleX, transform.scaleY);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		ctx.fillStyle = this.color.fillStyle();
		this.font.set(ctx);

		const tx = 0;
		let ty = 0;
		// adjust for verticalAlign
		if (this.verticalAlign == 'center' || this.verticalAlign == 'middle') {
			// do nothing
		} else if (this.verticalAlign == 'top') {
			ty += this.font.lineHeight * 0.5;
		} else if (this.verticalAlign == 'bottom') {
			ty -= this.font.lineHeight * 0.5;
		}

		if (this.wordWrap == undefined) {
			ctx.fillText(this.text, tx, ty);
		} else {
			const thisBreak = this.wordWrap + ':' + this.text;
			let lines = this.lastLines;
			if (thisBreak != this.lastBreak) {
				this.lastBreak = thisBreak;
				lines = this.lastLines = this.font.breaklines(this.text, this.wordWrap);
			}
			// adjust for verticalAlign
			if (this.verticalAlign == 'center' || this.verticalAlign == 'middle') {
				ty -= (lines.length - 1) * 0.5 * this.font.lineHeight;
			} else if (this.verticalAlign == 'top') {
				// do nothing
			} else if (this.verticalAlign == 'bottom') {
				ty -= (lines.length - 1) * this.font.lineHeight;
			}

			for (const line of lines) {
				ctx.fillText(line, tx, ty);
				ty += this.font.lineHeight;
			}
		}
		ctx.restore();
	}

	contentBounds () {
		const fontBounds = this.font.measure(this.text, this.wordWrap);
		const bounds = geometry.expandedRect(fontBounds, fontBounds.padding, fontBounds.padding);

		// adjust for verticalAlign
		if (this.verticalAlign == 'center' || this.verticalAlign == 'middle') {
			bounds.y -= (fontBounds.lines.length - 1) * 0.5 * fontBounds.lineHeight;
		} else if (this.verticalAlign == 'top') {
			bounds.y += fontBounds.lineHeight * 0.5;
		} else if (this.verticalAlign == 'bottom') {
			bounds.y -= (fontBounds.lines.length - 0.5) * fontBounds.lineHeight;
		}

		return bounds;
	}
}

// -- set up add methods from each class to each other class ----
const classList = {
	'DisplayList' : DisplayList,
	'Image' : Image,
	'Clip' : Clip,
	'Rect' : Rect,
	'Circle' : Circle,
	'Canvas' : Canvas,
	'Label' : Label,
};

for (const thisClassName in classList) {
	const thisClass = classList[thisClassName];
	for (const otherClassName in classList) {
		const otherClass = classList[otherClassName];
		thisClass.prototype['add' + otherClassName] = function () {
			const child = new otherClass(...arguments);
			this.add(child);
			return child;
		};
	}
}

export { DisplayList, Image, Clip, Rect, Circle, Canvas, Label, setDefaultFreezeScale };
