// node, standard heavy weight object used to create a back bone heirachy of objects at runtime
// the app module also acts as a single instance of managing current scene, timer, events and screen fit
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from './geometry.js';
import * as dispatch from './dispatch.js';
import * as coroutine from './coroutine.js';
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

	get_coroutine_manager() {
		if (!this.coroutine_manager) {
			this.coroutine_manager = new coroutine.coroutine_manager();
		}
		return this.coroutine_manager;
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
		const ta = ui.touch_area.rect(display_object, new geometry.rect(x, y, width, height), event_dispatch);
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
		if (this.coroutine_manager) {
			this.coroutine_manager.update();
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
		if (this.coroutine_manager) {
			this.coroutine_manager.safe_update();
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
		
		if (this.coroutine_manager) {
			this.coroutine_manager.dispose();
			this.coroutine_manager = null;
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

// -- app state held within this module ---

let safe_updates = false;

const render_callback = new ui.render_callback();
const fps = new ui.fixed_rate_timer(60);
const animation_fps = new ui.fixed_rate_timer(60);
const frame_dispatch = new dispatch.frame_dispatch();

let screen = null;
let current_scene = null;

const app_object = {
	fps: fps,
	animation_fps: animation_fps,
	set_frame_rate: set_frame_rate,
	set_safe_updates: set_safe_updates,
	set_scene: set_scene,
	frame_dispatch: frame_dispatch,
	pause: pause,
	resume: resume,
};

ui.button.configure((action) => {
	frame_dispatch.delay(1, action);
});

function update () {
	// keep up to date with window size
	if (screen != null) {
		screen.update();
	}

	let requires_render = false;
	const animation_frames = animation_fps.get_frames_due();
	if (animation_frames > 0 && screen != null) {
		requires_render = true;
		for (let i = 0; i < animation_frames; i++) {
			// update animation heirachy and fire off on-complete events once done
			const on_completes = [];
			screen.root_view.update_animated_clips(animation_fps.delta, (callback) => {
				on_completes.push(callback);
			});
			for (const callback of on_completes) {
				callback();
			}
		}
	}

	dispatch.shared_event_dispatch().dispatch_deferred();
	if (safe_updates) {
		frame_dispatch.safe_update();
	} else {
		frame_dispatch.update();
	}

	const update_frames = fps.get_frames_due();
	if (update_frames > 0 && current_scene != null) {
		requires_render = true;
		for (let f = 0; f < update_frames; f++) {
			if (current_scene != null) {
				if (safe_updates) {
					current_scene.safe_update();
				} else {
					current_scene.update();
				}
			}
		}
	}

	if (requires_render && screen != null) {
		screen.render();
	}
}

function set_safe_updates (value) {
	safe_updates = value;
}

function set_frame_rate (new_fps, new_animation_fps, min_frames, max_frames, reset) {
	if (!new_animation_fps) {
		new_animation_fps = new_fps;
	}
	fps.set_fps(new_fps, min_frames, max_frames, reset);
	animation_fps.set_fps(new_animation_fps, min_frames, max_frames, reset);
}

function pause () {
	render_callback.stop();
}

function resume () {
	render_callback.start(() => {
		update();
	});
}

function set_scene (scene) {
	if (current_scene != null) {
		current_scene.dispose();
		current_scene = null;
	}

	// can't clear event dispatch here in case of things hooked globally, might be a problem for button callbacks
	dispatch.reset_shared_event_dispatch();

	if (scene) {
		current_scene = scene;
		current_scene.app = app_object;
		current_scene.screen = screen;

		current_scene.prepare();
		if (screen != null) {
			screen.root_view.add(scene.view);
		}
		current_scene.begin();
	}

	fps.reset();
	animation_fps.reset();
}

function launch (canvas, scene, width, height, fit) {
	screen = (canvas != null) ? new ui.canvas_screen(canvas, width, height, fit) : null;
	set_scene(scene);
	resume();
	return app_object;
}

export { node, screen, launch, set_scene, pause, resume, set_frame_rate, frame_dispatch, set_safe_updates, fps, animation_fps };