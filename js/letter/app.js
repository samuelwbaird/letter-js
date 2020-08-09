// an app object, a single instance of which is created at launch, managing timer, events and screen fit
// copyright 20202 Samuel Baird MIT Licence

import * as geometry from './geometry.js';
import * as dispatch from './dispatch.js';
import * as event_dispatch from './event_dispatch.js';
import * as resources from './resources.js';

import display_list from './display_list.js';
import button from './button.js';

class fixed_rate_timer {

	constructor (fps, min_frames, max_frames, reset_frames) {
		this.set_fps(fps, min_frames, max_frames, reset_frames);
	}

	set_fps (fps, min_frames = 1, max_frames = 4, reset_frames = 16) {
		this.fps = fps;
		this.min_frames = min_frames;
		this.max_frames = max_frames;
		this.reset_frames = reset_frames;
		this.reset();
	}

	reset () {
		this.last_time = Date.now();
		this.time_accumulated = 0;
	}

	get_frames_due () {
		const now = Date.now();
		const delta = (now - this.last_time) / 1000.0;
		this.time_accumulated += delta;
		this.last_time = now;

		let frames_due = Math.floor(this.time_accumulated * this.fps);

		if (this.reset_frames > 0 && frames_due > this.reset_frames) {
			this.time_accumulated = 0;
			frames_due = 1;
		} else if (this.max_frames > 0 && frames_due > this.max_frames) {
			this.time_accumulated = 0;
			frames_due = this.max_frames;
		} else if (this.min_frames > 0 && frames_due < this.min_frames) {
			frames_due = 0;
		} else {
			this.time_accumulated -= frames_due / this.fps;
		}

		return frames_due;
	}

}

class app {

	constructor (screen, timer) {
		this.screen = screen;
		this.timer = timer;
		this.fps = new fixed_rate_timer(60);
		this.animation_fps = new fixed_rate_timer(60);
		this.safe_updates = false;
		this.resources = resources;

		this.dispatch = new dispatch.frame_dispatch();
		this.current_scene = null;

		button.configure((action) => {
			this.dispatch.delay(1, action);
		});
	}

	set_scene (scene) {
		if (this.current_scene != null) {
			this.current_scene.dispose();
			this.current_scene = null;
		}

		// can't clear event dispatch here in case of things hooked globally, might be a problem for button callbacks
		event_dispatch.reset_shared_instance();

		// if a string reference then load before continuing
		if (typeof scene == 'string') {
			/* eslint-disable */
			// import(scene).then((loaded_scene_class) => {
			// 	this.set_scene(new loaded_scene_class());
			// 		    });
			return;
			/* eslint-enable */
		}

		if (scene) {
			this.last_time = null;
			this.current_scene = scene;
			this.current_scene.app = this;
			this.current_scene.resources = resources;
			this.current_scene.screen = this.screen;

			this.current_scene.prepare();
			if (this.screen != null) {
				this.screen.root_view.add(scene.view);
			}
			this.current_scene.begin();
		}

		this.fps.reset();
		this.animation_fps.reset();
	}

	update () {
		// keep up to date with window size
		if (this.screen != null) {
			this.screen.update();
		}

		let requires_render = false;
		const animation_frames = this.animation_fps.get_frames_due();
		if (animation_frames > 0 && this.screen != null) {
			requires_render = true;
			for (let i = 0; i < animation_frames; i++) {
				// update animation heirachy and fire off on-complete events once done
				const on_completes = [];
				this.screen.root_view.update_animated_clips(1.0 / this.fps, (callback) => {
					on_completes.push(callback);
				});
				for (const callback of on_completes) {
					callback();
				}
			}
		}

		event_dispatch.shared_instance().dispatch_deferred();
		if (this.safe_updates) {
			this.dispatch.safe_update();
		} else {
			this.dispatch.update();
		}

		const update_frames = this.fps.get_frames_due();
		if (update_frames > 0 && this.current_scene != null) {
			requires_render = true;
			for (let f = 0; f < update_frames; f++) {
				if (this.current_scene != null) {
					if (this.safe_updates) {
						this.current_scene.safe_update();
					} else {
						this.current_scene.update();
					}
				}
			}
		}

		if (requires_render && this.screen != null) {
			this.screen.render();
		}
	}

	set_frame_rate (fps, animation_fps, min_frames, max_frames, reset) {
		if (!animation_fps) {
			animation_fps = fps;
		}
		this.fps = new fixed_rate_timer(fps, min_frames, max_frames, reset);
		this.animation_fps = new fixed_rate_timer(animation_fps, min_frames, max_frames, reset);
	}

	pause () {
		this.timer.stop();
	}

	resume () {
		this.timer.start(() => {
			this.update();
		});
	}

}

class screen {
	constructor (canvas, ideal_width, ideal_height, fit) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.ideal_height = ideal_height;
		this.ideal_width = ideal_width;
		this.fit = fit;
		this.root_view = new display_list();

		this.update();

		canvas.addEventListener('mousedown', (evt) => {
			this.touch_event('touch_begin', evt);
		}, false);
		canvas.addEventListener('mousemove', (evt) => {
			this.touch_event('touch_move', evt);
		}, false);
		canvas.addEventListener('mouseup', (evt) => {
			this.touch_event('touch_end', evt);
		}, false);

		canvas.addEventListener('touchstart', (evt) => {
			this.touch_event('touch_begin', evt);
		}, false);
		canvas.addEventListener('touchmove', (evt) => {
			this.touch_event('touch_move', evt);
		}, false);
		canvas.addEventListener('touchend', (evt) => {
			this.touch_event('touch_end', evt);
		}, false);
		canvas.addEventListener('touchcancel', (evt) => {
			this.touch_event('touch_cancel', evt);
		}, false);
	}

	touch_event (event_name, evt) {
		evt.preventDefault();

		// correct co-ords for hdpi displays
		const scale_x = this.canvas.width / this.canvas.clientWidth;
		const scale_y = this.canvas.height / this.canvas.clientHeight;

		if (evt.changedTouches) {
			for (const touch of evt.changedTouches) {
				event_dispatch.shared_instance().defer(event_name, { id : touch.identifier, time : Date.now, x : (touch.pageX - this.canvas.offsetLeft) * scale_x, y : (touch.pageY - this.canvas.offsetTop) * scale_y });
			}
		} else {
			event_dispatch.shared_instance().defer(event_name, { id : 1, time : Date.now, x : (evt.pageX - this.canvas.offsetLeft) * scale_x, y : (evt.pageY - this.canvas.offsetTop) * scale_y });
		}
	}

	update () {
		// update transform of root view to match sizing

		// update scaling to fit nominal sizing to canvas size
		const scale_x = this.canvas.width / this.ideal_width;
		const scale_y = this.canvas.height / this.ideal_height;
		let scale = 1;

		if (this.fit == 'fit') {
			scale = (scale_x < scale_y) ? scale_x : scale_y;
		} else {
			// other screenfit strategies
		}

		this.content_scale = scale;
		this.width = this.canvas.width / scale;
		this.height = this.canvas.height / scale;

		this.root_view.scale_x = scale;
		this.root_view.scale_y = scale;
	}

	render () {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.root_view.render(this.ctx, geometry.default_transform);
	}

}

class timer {

	constructor () {
		this.active = false;
	}

	start (callback) {
		this.callback = callback;
		this.active = true;

		window.requestAnimationFrame(() => {
			this.next_frame();
		});
	}

	next_frame () {
		if (!this.active) {
			return;
		}

		window.requestAnimationFrame(() => {
			this.next_frame();
		});
		this.callback();
	}


	stop () {
		this.active = false;
		this.callback = null;
	}

}

function launch (canvas, scene, width, height, fit) {
	const _screen = (canvas != null) ? new screen(canvas, width, height, fit) : null;

	const _timer = new timer();
	const _app = new app(_screen, _timer);

	window.app = _app;
	window.resources = resources;

	_app.set_scene(scene);
	_app.resume();
	return _app;
}

export { fixed_rate_timer, app, screen, timer, launch };
export default app;