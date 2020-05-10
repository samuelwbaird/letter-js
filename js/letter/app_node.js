'use strict';
var global = window
// standard heavy weight object used to create a back bone heirachy of objects at runtime
// copyright 2016 Samuel Baird MIT Licence

define(['letter.dispatch', 'letter.display_list', 'letter.tween', 'letter.touch_area', 'letter.button', 'letter.geometry'], function (dispatch, display_list, tween, touch_area, button, geometry) {
	return klass(function (app_node) {
				
		app_node.init = function () {
			this.view = new display_list.display_list();
			
			this.tween_manager = null;
			this.frame_dispatch = null;
			
			this.children = null;
			this.disposables = null;
		}
		
		app_node.add_disposable = function (disposable) {
			if (!this.disposables) {
				this.disposables = [];
			}
			this.disposables.push(disposable);
		}		
				
		// override
		app_node.prepare = function () {}
		app_node.begin = function () {}
		
		app_node.add = function (child, view_parent) {
			if (!this.children) {
				this.children = new update_list();
			}
			this.children.add(child);
			
			child.app = this.app
			child.resources = this.resources
			child.screen = this.screen
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
		
		app_node.remove = function (child) {
			if (!this.children) {
				return;
			}
			if (this.children.remove(child)) {
				child.dispose();
			}
		}
		
		app_node.get_tween_manager = function () {
			if (!this.tween_manager) {
				this.tween_manager = new tween.manager();
			}
			return this.tween_manager;
		}
		
		app_node.tween = function (target, easing, properties, on_complete) {
			var t = new tween.tween(target, easing, properties, on_complete)
			this.get_tween_manager().add(t);
			return t;
		}
		
		app_node.get_frame_dispatch = function () {
			if (!this.frame_dispatch) {
				this.frame_dispatch = new dispatch.frame_dispatch();
			}
			return this.frame_dispatch;
		}
		
		app_node.delay = function (count, fn, tag) {
			this.get_frame_dispatch().delay(count, fn, tag);
		}
		
		app_node.add_button = function (clip, action, event_dispatch, init_values) {
			var btn = new button(clip, action, event_dispatch, init_values);
			this.add_disposable(btn);
			return btn;
		}
	
		app_node.add_touch_area = function (display_object, padding, event_dispatch) {
			var ta = touch_area.bounds(display_object, padding, event_dispatch);
			this.add_disposable(ta);
			return ta;
		}
		
		app_node.add_touch_area_rect = function (display_object, x, y, width, height, event_dispatch) {
			var ta = touch_area.rect(display_object, geometry.rect(x, y, width, height), event_dispatch);
			this.add_disposable(ta);
			return ta;
		}
		
		app_node.update = function () {
			if (global.safe_updates) {
				if (this.tween_manager) {
					this.tween_manager.safe_update();
				}
				if (this.frame_dispatch) {
					this.frame_dispatch.safe_update();
				}
				if (this.children) {
					this.children.safe_update(function (child) {
						child.update();
					})
				}
			} else {
				if (this.tween_manager) {
					this.tween_manager.update();
				}
				if (this.frame_dispatch) {
					this.frame_dispatch.update();
				}
				if (this.children) {
					this.children.update(function (child) {
						child.update();
					})
				}
			}
		}
		
		app_node.dispose = function () {
			if (this.view) {
				this.view.remove_from_parent();
			}
			
			if (this.children) {
				this.children.update(function (child) {
					child.dispose();
				})
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
				this.disposables.with_each(function (disposable) {
					if (typeof disposable == 'function') {
						disposable();
					} else if (disposable.dispose) {
						disposable.dispose();
					} else {
						throw "cannot dispose " + disposable
					}
				});
				this.disposables = null;
			}
		}
		
	});
})