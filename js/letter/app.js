// node, standard heavy weight object used to create a back bone heirachy of objects at runtime
// an app object, a single instance of which is created at launch, managing timer, events and screen fit
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from './geometry.js';
import * as dispatch from './dispatch.js';
import * as resource from './resource.js';
import * as display from './display.js';
import * as ui from './ui.js';
import * as tween from './tween.js';

class node {

	constructor () {
		this.view = new display.display_list();

		this.tween_manager = null;
		this.frame_dispatch = null;
		this.use_safe_updates = false;

		this.children = null;
		this.disposables = null;
	}

	add_disposable (disposable) {
		if (!this.disposables) {
			this.disposables = [];
		}
		this.disposables.push(disposable);
	}

	// override
	prepare () {}
	begin () {}

	add (child, view_parent) {
		if (!this.children) {
			this.children = new dispatch.update_list();
		}
		this.children.add(child);

		child.app = this.app;
		child.resource = this.resource;
		child.screen = this.screen;
		child.prepare();

		// view_parent = false to not add, or this nodes view by default
		if (view_parent == undefined) {
			view_parent = this.view;
		}
		if (view_parent) {
			view_parent.add(child.view);
		}
		// begin is called only once the view is added
		child.begin();

		return child;
	}

	remove (child) {
		if (!this.children) {
			return;
		}
		if (this.children.remove(child)) {
			child.dispose();
		}
	}

	get_tween_manager () {
		if (!this.tween_manager) {
			this.tween_manager = new tween.manager();
		}
		return this.tween_manager;
	}

	tween (target, easing, properties, optional_params) {
		const t = new tween.tween(target, easing, properties, optional_params);
		this.get_tween_manager().add(t);
		return t;
	}

	get_frame_dispatch () {
		if (!this.frame_dispatch) {
			this.frame_dispatch = new dispatch.frame_dispatch();
		}
		return this.frame_dispatch;
	}

	delay (count, fn, tag) {
		this.get_frame_dispatch().delay(count, fn, tag);
	}

	add_button (clip, action, event_dispatch, init_values) {
		const btn = new ui.button(clip, action, event_dispatch, init_values);
		this.add_disposable(btn);
		return btn;
	}

	add_touch_area (display_object, padding, event_dispatch) {
		const ta = ui.touch_area.bounds(display_object, padding, event_dispatch);
		this.add_disposable(ta);
		return ta;
	}

	add_touch_area_rect (display_object, x, y, width, height, event_dispatch) {
		const ta = ui.touch_area.rect(display_object, geometry.rect(x, y, width, height), event_dispatch);
		this.add_disposable(ta);
		return ta;
	}

	update () {
		if (this.use_safe_updates) {
			this.safe_update();
			return;
		}

		if (this.tween_manager) {
			this.tween_manager.update();
		}
		if (this.frame_dispatch) {
			this.frame_dispatch.update();
		}
		if (this.children) {
			this.children.update((child) => {
				child.update();
			});
		}
	}

	safe_update () {
		if (this.tween_manager) {
			this.tween_manager.safe_update();
		}
		if (this.frame_dispatch) {
			this.frame_dispatch.safe_update();
		}
		if (this.children) {
			this.children.safe_update((child) => {
				child.safe_update();
			});
		}
	}

	dispose () {
		if (this.view) {
			this.view.remove_from_parent();
		}

		if (this.children) {
			this.children.update((child) => {
				child.dispose();
			});
			this.children = null;
		}

		if (this.tween_manager) {
			this.tween_manager.dispose();
			this.tween_manager = null;
		}

		if (this.frame_dispatch) {
			this.frame_dispatch.dispose();
			this.frame_dispatch = null;
		}

		if (this.disposables) {
			for (const disposable of this.disposables) {
				if (typeof disposable == 'function') {
					disposable();
				} else if (disposable.dispose) {
					disposable.dispose();
				} else {
					throw 'cannot dispose ' + disposable;
				}
			}
			this.disposables = null;
		}
	}
}

class app {

	constructor (screen, timer) {
		this.screen = screen;
		this.timer = timer;
		this.fps = new fixed_rate_timer(60);
		this.animation_fps = new fixed_rate_timer(60);
		this.safe_updates = false;
		this.resource = resource;

		this.dispatch = new dispatch.frame_dispatch();
		this.current_scene = null;

		ui.button.configure((action) => {
			this.dispatch.delay(1, action);
		});
	}

	set_scene (scene) {
		if (this.current_scene != null) {
			this.current_scene.dispose();
			this.current_scene = null;
		}

		// can't clear event dispatch here in case of things hooked globally, might be a problem for button callbacks
		dispatch.reset_shared_event_dispatch();

		if (scene) {
			this.last_time = null;
			this.current_scene = scene;
			this.current_scene.app = this;
			this.current_scene.resource = resource;
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

		dispatch.shared_event_dispatch().dispatch_deferred();
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



function launch (canvas, scene, width, height, fit) {
	const screen = (canvas != null) ? new ui.canvas_screen(canvas, width, height, fit) : null;

	const _timer = new timer();
	const _app = new app(screen, _timer);

	window.app = _app;

	_app.set_scene(scene);
	_app.resume();
	return _app;
}

export { node, fixed_rate_timer, app, timer, launch };
