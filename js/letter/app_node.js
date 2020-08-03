// standard heavy weight object used to create a back bone heirachy of objects at runtime
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from './geometry.js';
import * as dispatch from './dispatch.js';
import * as tween from './tween.js';
import * as touch_area from './touch_area.js';
import * as display_list from './display_list.js';
import * as button from './button.js';

class app_node {

	constructor () {
		this.view = new display_list.display_list();

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
		child.resources = this.resources;
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
		const btn = new button(clip, action, event_dispatch, init_values);
		this.add_disposable(btn);
		return btn;
	}

	add_touch_area (display_object, padding, event_dispatch) {
		const ta = touch_area.bounds(display_object, padding, event_dispatch);
		this.add_disposable(ta);
		return ta;
	}

	add_touch_area_rect (display_object, x, y, width, height, event_dispatch) {
		const ta = touch_area.rect(display_object, geometry.rect(x, y, width, height), event_dispatch);
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

export default app_node;