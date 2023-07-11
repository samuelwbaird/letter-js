// manage a touch area over a display list transform from event dispatch
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from  './geometry.js';
import * as dispatch from './dispatch.js';
import * as display from  './display.js';

// TODO: migrate all touch area events here too and make sure they are exported correctly

export const configButtonTouchOuterPadding = 'config_button_touch_outer_padding';
export const eventButtonDown = 'event_button_down';
export const eventButtonUP = 'event_button_up';

const dispatchDelayedButton = 'dispatch_delayed_button';

class TouchArea {

	constructor (pointConversion, areaTest, context) {
		this.pointConversion = pointConversion;
		this.areaTest = areaTest;
		this.context = context;
		this.eventHandler = new dispatch.EventHandler(context.eventDispatch);
		this.enabled = true;

		// initialise values
		this.cancelTouch();

		// clients should supply these
		this.onTouchBegin = null;
		this.onTouchMove = null;
		this.onTouchEnd = null;
		this.onTouchCancel = null;
	}

	cancelTouch () {
		if (this.isTouched) {
			this.isTouched = false;
			if (this.onTouchCancel) {
				this.onTouchCancel(this);
			}
		}

		this.isTouched = false;
		this.isTouchOver = false;
		this.touchID = null;

		this.touchTime = null;
		this.touchPosition = null;

		this.touchStartTime = null;
		this.touchStartPosition = null;

		this.dragDistance = null;
		this.moveDistance = null;
	}

	get enabled () {
		return this.eventHandler.didListen;
	}

	set enabled (value) {
		if (value && !this.eventHandler.didListen) {
			this.eventHandler.listen('touch_begin', (touchData) => {
				this.handleTouchBegin(touchData);
			});
			this.eventHandler.listen('touch_move', (touchData) => {
				this.handleTouchMove(touchData);
			});
			this.eventHandler.listen('touch_end', (touchData) => {
				this.handleTouchEnd(touchData);
			});
			this.eventHandler.listen('touch_cancel', (touchData) => {
				this.handleTouchCancel(touchData);
			});
			this.eventHandler.listen(dispatch.eventInterruptContext, () => {
				this.cancelTouch();
			});
		} else if (!value && this.eventHandler.didListen) {
			this.eventHandler.unlisten();
			this.cancelTouch();
		}
	}

	handleTouchBegin (touchData) {
		if (this.touchID) {
			return;
		}			// already tracking a touch
		if (!this.pointConversion) {
			return;
		}	// no longer valid

		const point = this.pointConversion(touchData);
		const isTouchOver = this.areaTest(point);

		if (!isTouchOver) {
			return;
		}

		// -- TODO: check for filtering and intercepts here
		this.isTouched = true;
		this.isTouchOver = true;
		this.touchID = touchData.id;

		this.touchPosition = point;
		this.touchTime = touchData.time;

		this.touchStartPosition = { x : point.x, y : point.y };
		this.touchStartTime = this.touchTime;

		this.dragDistance = null;
		this.moveDistance = null;

		if (this.onTouchBegin) {
			this.onTouchBegin(this);
		}
	}

	handleTouchMove (touchData) {
		if (this.touchID != touchData.id) {
			return;
		}

		this.updateValues(this.pointConversion(touchData), touchData.time);
		if (this.onTouchMove) {
			this.onTouchMove(this);
		}
	}

	handleTouchEnd (touchData) {
		if (this.touchID != touchData.id) {
			return;
		}

		this.updateValues(this.pointConversion(touchData), touchData.time);
		this.isTouched = false;
		if (this.onTouchEnd) {
			this.onTouchEnd(this);
		}
		this.cancelTouch();
	}

	handleTouchCancel (touchData) {
		if (this.touchID != touchData.id) {
			return;
		}
		this.cancelTouch();
	}

	updateValues (point, time) {
		const previousPosition = this.touchPosition;
		this.isTouchOver = this.areaTest(point);
		this.touchPosition = point;
		this.touchTime = time;

		this.dragDistance = { x : point.x - this.touchStartPosition.x, y : point.y - this.touchStartPosition.y };
		this.moveDistance = { x : point.x - previousPosition.x, y : point.y - previousPosition.y };
	}

	dispose () {
		if (this.eventHandler) {
			this.eventHandler.dispose();
			this.eventHandler = null;
		}
		this.onTouchBegin = null;
		this.onTouchMove = null;
		this.onTouchEnd = null;
	}


	// add static constructors
	static bounds (displayObject, padding, context) {
		if (padding == undefined) {
			padding = 0;
		}
		return new TouchArea(
			// point conversion
			((point) => {
				return displayObject.worldToLocal(point);
			}),
			// area test
			((point) => {
				let rect = displayObject.bounds();
				rect = geometry.expandedRect(rect, padding, padding);
				return rect.containsPoint(point);
			}),
			context
		);
	}

	static rect (displayObject, rect, context) {
		return new TouchArea(
			// point conversion
			((point) => {
				return displayObject.worldToLocal(point);
			}),
			// area test
			((point) => {
				return rect.containsPoint(point);
			}),
			context
		);
	}
}


// adds two frame button behaviour to an animated display object
// copyright 2020 Samuel Baird MIT Licence

class Button {

	constructor (clip, action, initValues, context) {
		// base properties for a button
		this.clip = clip;
		this.action = action;
		this.context = context;
		this.eventHandler = new dispatch.EventHandler(context.eventDispatch);

		// override these properties if required
		if (clip.goto != null) {
			// if the clip appears to be an animated clip then default to using these frames as the button states
			this.upFrame = 1;
			this.downFrame = 2;
		}

		if (initValues) {
			for (const k in initValues) {
				this[k] = initValues[k];
			}
		}

		// internal
		this.isDown = false;
		this.isReleasing = false;

		const buttonTouchOutPadding = context.get('config_button_touch_outer_padding', 20);

		this.touchAreaInner = TouchArea.bounds(clip, 0, context);
		this.touchAreaOuter = TouchArea.bounds(clip, buttonTouchOutPadding, context);

		this.touchAreaInner.onTouchBegin = () => {
			this.update();
		};
		this.touchAreaInner.onTouchMove = () => {
			this.update();
		};
		this.touchAreaOuter.onTouchBegin = () => {
			this.update();
		};
		this.touchAreaOuter.onTouchMove = () => {
			this.update();
		};
		this.touchAreaOuter.onTouchEnd = () => {
			this.handleButtonRelease();
		};
		this.touchAreaOuter.onTouchCancel = () => {
			this.cancelTouch();
		};
		this.eventHandler.listen(dispatch.eventInterruptContext, () => {
			this.context.frameDispatch.remove(dispatchDelayedButton);
		});
	}

	get enabled () {
		return this.touchAreaInner.enabled && this.touchAreaOuter.enabled;
	}

	set enabled (value) {
		if (this.touchAreaInner) {
			this.touchAreaInner.enabled = value;
			this.touchAreaOuter.enabled = value;
		}
		this.update();
	}

	isVisible () {
		return this.clip.isVisible();
	}

	update () {
		if (this.enabled && this.isVisible() && this.touchAreaInner.isTouched && this.touchAreaOuter.isTouchOver && !this.isReleasing) {
			if (!this.isDown) {
				this.isDown = true;
				if (typeof this.downFrame == 'function') {
					this.downFrame(this);
				} else if (this.clip.goto != null) {
					this.clip.goto(this.downFrame);
				}

				// dispatch an event for global button down
				this.context.eventDispatch.defer(eventButtonDown, { button: this });
			}
		} else {
			if (this.isDown) {
				this.isDown = false;
				if (typeof this.upFrame == 'function') {
					this.upFrame(this);
				} else if (this.clip.goto != null) {
					this.clip.goto(this.upFrame);
				}

				// dispatch an event for global button up
				this.context.eventDispatch.defer(eventButtonUP, { button: this });
			}
		}
	}

	handleButtonRelease () {
		if (this.isReleasing) {
			return;
		}

		if (this.isDown) {
			this.isReleasing = true;
			this.update();

			this.context.frameDispatch.delay(1, () => {
				this.action(this);
				this.isReleasing = false;
			}, dispatchDelayedButton);
		}
	}

	cancelTouch () {
		if (this.isReleasing) {
			return;
		}

		if (this.touchAreaInner) {
			this.touchAreaInner.cancelTouch();
		}
		if (this.touchAreaOuter) {
			this.touchAreaOuter.cancelTouch();
		}
		this.update();
	}

	dispose () {
		if (this.touchAreaInner) {
			this.touchAreaInner.dispose();
			this.touchAreaInner = null;
		}
		if (this.touchAreaOuter) {
			this.touchAreaOuter.dispose();
			this.touchAreaOuter = null;
		}
		this.clip = null;
		this.action = null;
	}
}

class ScrollBehaviour {

	constructor (touchArea, viewWidth, viewHeight, scrollParent) {
		this.touchArea = touchArea;
		this.viewWidth = viewWidth;
		this.viewHeight = viewHeight;
		this.scrollParent = scrollParent;

		this.contentX = 0;
		this.contentY = 0;
		this.momentumX = 0;
		this.momentumY = 0;

		this.damping = 0.95;
		this.stretch = 0.1;
		this.snap = 0.5;

		this.setContentSize(viewWidth, viewHeight);

		this.touchArea.onTouchMove = (ta) => {
			if (ta.isTouched) {
				if (this.scrollX) {
					const maxX = (this.contentWidth - this.viewWidth);
					if (this.contentX < 0 && ta.moveDistance.x > 0) {
						this.contentX -= ta.moveDistance.x * this.stretch;
					} else if (this.contentX > maxX && ta.moveDistance.x < 0) {
						this.contentX -= ta.moveDistance.x * this.stretch;
					} else {
						this.contentX -= ta.moveDistance.x;
					}

					this.momentumX = -ta.moveDistance.x;
				}
				if (this.scrollY) {
					const maxY = (this.contentHeight - this.viewHeight);
					if (this.contentY < 0 && ta.moveDistance.y > 0) {
						this.contentY -= ta.moveDistance.y * this.stretch;
					} else if (this.contentY > maxY && ta.moveDistance.y < 0) {
						this.contentY -= ta.moveDistance.y * this.stretch;
					} else {
						this.contentY -= ta.moveDistance.y;
					}

					this.momentumY = -ta.moveDistance.y;
				}
			}
		};

	}

	setContentSize (width, height) {
		this.contentWidth = width;
		this.contentHeight = height;
		this.scrollX = (this.contentWidth > this.viewWidth);
		this.scrollY = (this.contentHeight > this.viewHeight);
	}

	setPosition (x, y) {
		this.contentX = x;
		this.contentY = y;
		this.momentumX = 0;
		this.momentumY = 0;
		this.touchArea.cancelTouch();
	}

	update () {
		// bounce back in when not touched
		if (!this.touchArea.isTouched) {
			if (this.scrollX) {
				this.contentX += this.momentumX;

				const maxX = (this.contentWidth - this.viewWidth);
				if (this.contentX < 0) {
					this.contentX *= this.snap;
				} else if (this.contentX > maxX) {
					this.contentX = maxX + (this.contentX - maxX) * this.snap;
				}
			}
			if (this.scrollY) {
				this.contentY += this.momentumY;

				const maxY = (this.contentHeight - this.viewHeight);
				if (this.contentY < 0) {
					this.contentY *= this.snap;
				} else if (this.contentY > maxY) {
					this.contentY = maxY + (this.contentY - maxY) * this.snap;
				}
			}
		}

		this.momentumX *= this.damping;
		this.momentumY *= this.damping;

		// update scroll parent if we have it
		if (this.scrollParent != null) {
			this.scrollParent.x = -this.contentX;
			this.scrollParent.y = -this.contentY;
		}
	}

	dispose () {

	}
}

class CanvasScreen  {
	constructor (canvas, idealWidth, idealHeight, fit) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.idealHeight = idealHeight;
		this.idealWidth = idealWidth;
		this.fit = fit;
		this.rootView = new display.DisplayList();

		this.update();

		canvas.addEventListener('mousedown', (evt) => {
			this.touchEvent('touch_begin', evt);
		}, false);
		canvas.addEventListener('mousemove', (evt) => {
			this.touchEvent('touch_move', evt);
		}, false);
		window.addEventListener('mouseup', (evt) => {
			this.touchEvent('touch_end', evt);
		}, false);
		canvas.addEventListener('contextmenu', (evt) => {
			evt.preventDefault();
		}, false);

		canvas.addEventListener('touchstart', (evt) => {
			this.touchEvent('touch_begin', evt);
		}, false);
		canvas.addEventListener('touchmove', (evt) => {
			this.touchEvent('touch_move', evt);
		}, false);
		canvas.addEventListener('touchend', (evt) => {
			this.touchEvent('touch_end', evt);
		}, false);
		canvas.addEventListener('touchcancel', (evt) => {
			this.touchEvent('touch_cancel', evt);
		}, false);
	}

	setContext (context) {
		this.context = context;
		this.context.set('screen', this);
		this.context.set('canvas', this.canvas);
		this.context.set('ctx', this.ctx);
	}

	touchEvent (eventName, evt) {
		evt.preventDefault();

		if (this.context == null) {
			return;
		}

		// where will events be dispatched, can be overridden by the context
		const eventDispatch = this.context.getActive().eventDispatch;

		// correct co-ords for hdpi displays
		const scaleX = this.canvas.width / this.canvas.clientWidth;
		const scaleY = this.canvas.height / this.canvas.clientHeight;

		if (evt.changedTouches) {
			for (const touch of evt.changedTouches) {
				eventDispatch.defer(eventName, { id : touch.identifier, time : Date.now(), x : (touch.pageX - this.canvas.offsetLeft) * scaleX, y : (touch.pageY - this.canvas.offsetTop) * scaleY });
			}
		} else {
			eventDispatch.defer(eventName, { id : 1, time : Date.now(), x : (evt.pageX - this.canvas.offsetLeft) * scaleX, y : (evt.pageY - this.canvas.offsetTop) * scaleY });
		}
	}

	update () {
		// update transform of root view to match sizing

		// update scaling to fit nominal sizing to canvas size
		const scaleX = this.canvas.width / this.idealWidth;
		const scaleY = this.canvas.height / this.idealHeight;
		let scale = 1;

		if (this.fit == 'fit') {
			scale = (scaleX < scaleY) ? scaleX : scaleY;
		} else {
			// other screenfit strategies
		}

		this.contentScale = scale;
		this.width = Math.floor(this.canvas.width / scale);
		this.height = Math.floor(this.canvas.height / scale);

		this.rootView.scaleX = scale;
		this.rootView.scaleY = scale;
	}

	render () {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.rootView.render(this.ctx, geometry.Transform.identity());
	}
}

class RenderCallback {
	constructor () {
		this.active = false;
	}

	start (callback) {
		this.callback = callback;
		this.active = true;
		window.requestAnimationFrame(() => {
			this.nextFrame();
		});
	}

	nextFrame () {
		if (!this.active) {
			return;
		}
		window.requestAnimationFrame(() => {
			this.nextFrame();
		});
		this.callback();
	}

	stop () {
		this.active = false;
		this.callback = null;
	}
}

class FixedRateTimer {
	constructor (fps, minFrames, maxFrames, resetFrames) {
		this.setFps(fps, minFrames, maxFrames, resetFrames);
	}

	setFps (fps, minFrames = 1, maxFrames = 4, resetFrames = 16) {
		this.fps = fps;
		this.delta = 1 / fps;
		this.minFrames = minFrames;
		this.maxFrames = maxFrames;
		this.resetFrames = resetFrames;
		this.reset();
	}

	reset () {
		this.lastTime = Date.now();
		this.timeAccumulated = 0;
	}

	getFramesDue () {
		const now = Date.now();
		const delta = (now - this.lastTime) / 1000.0;
		this.timeAccumulated += delta;
		this.lastTime = now;

		let framesDue = Math.floor(this.timeAccumulated * this.fps);

		if (this.resetFrames > 0 && framesDue > this.resetFrames) {
			this.timeAccumulated = 0;
			framesDue = 1;
		} else if (this.maxFrames > 0 && framesDue > this.maxFrames) {
			this.timeAccumulated = 0;
			framesDue = this.maxFrames;
		} else if (this.minFrames > 0 && framesDue < this.minFrames) {
			framesDue = 0;
		} else {
			this.timeAccumulated -= framesDue / this.fps;
		}

		return framesDue;
	}
}

export { TouchArea, Button, ScrollBehaviour, CanvasScreen, RenderCallback, FixedRateTimer };
