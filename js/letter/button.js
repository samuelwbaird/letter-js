'use strict';
// adds two frame button behaviour to an animated display object
// copyright 2016 Samuel Baird MIT Licence

define(['letter.touch_area'], function (touch_area) {
	
	// configure these with later static method
	
	// static method used to dispatch button actions
	// replace with a method that delays by 1 frame to allow visual button update
	var button_action_callback = function (action) { action(); }
	// override these functions to provide universal button click sounds if required
	var button_on_button_down = function () {}
	var button_on_button_up = function () {}
	// how much extra logical space to allow on the outer touch area
	var button_touch_out_padding = 20;
	
	var button = klass(function (button) {
		button.init = function (clip, action, event_dispatch) {
			// base properties for a button
			this.clip = clip
			this.action = action
			this.event_dispatch = event_dispatch
		
			// override these properties if required
			this.up_frame = 1
			this.down_frame = 2
			this.is_down = false
			this.is_releasing = false
		
			this.touch_area_inner = touch_area.bounds(clip, 0, event_dispatch)
			this.touch_area_outer = touch_area.bounds(clip, button_touch_out_padding, event_dispatch)
		
			var self = this;
			this.touch_area_inner.on_touch_begin = function () { self.update(); }
			this.touch_area_inner.on_touch_move = function () { self.update(); }
			this.touch_area_inner.on_touch_end = function () { self.update(); }

			this.touch_area_outer.on_touch_begin = function () { self.update(); }
			this.touch_area_outer.on_touch_move = function () { self.update(); }
			this.touch_area_outer.on_touch_end = function () { self.handle_button_release(); }
		}
		
		button.get_enabled = function () {
			return this.touch_area_inner.get_enabled() && this.touch_area_outer.get_enabled();
		}
		
		button.set_enabled = function (value) {
			if (this.touch_area_inner) {
				this.touch_area_inner.set_enabled(value);
				this.touch_area_outer.set_enabled(value);
			}
			this.update();
		}
		
		button.is_visible = function () {
			return this.clip.is_visible();
		}

		button.update = function () {
			if (this.get_enabled() && this.is_visible() && this.touch_area_inner.is_touched && this.touch_area_outer.is_touch_over && !this.is_releasing) {
				if (!this.is_down) {
					this.is_down = true;
					button_on_button_down(this);
					if (typeof this.down_frame == 'function') {
						this.down_frame(this);
					} else {
						this.clip.goto(this.down_frame);
					}
				}
			} else {
				if (this.is_down) {
					this.is_down = false;
					button_on_button_up(this);
					if (typeof this.up_frame == 'function') {
						this.up_frame(this);
					} else {
						this.clip.goto(this.up_frame);
					}
				}
			}
			
		}
		
		button.handle_button_release = function () {
			if (this.is_releasing) { return; }

			if (this.is_down) {
				this.is_releasing = true;
				this.update();
		
				var self = this;
				button_action_callback(function () {
					self.action(self);
					self.is_releasing = false;
				})
			}
		}
		
		button.cancel_touch = function  () {
			if (this.is_releasing) { return; }
		
			if (this.touch_area_inner) {
				this.touch_area_inner.cancel_touch();
			}
			if (this.touch_area_outer) {
				this.touch_area_outer.cancel_touch();
			}
			this.update();
		}
		
		button.dispose = function () {
			if (this.touch_area_inner) {
				this.touch_area_inner.dispose();
				this.touch_area_inner = null;
			}
			if (this.touch_area_outer) {
				this.touch_area_outer.dispose();
				this.touch_area_outer = null;
			}
			this.clip = null;
			this.action = null;
		}
	});
	
	button.configure = function (delayed_action, on_button_up, on_button_down, padding) {
		button_action_callback = delayed_action;
		button_on_button_down = (on_button_down != undefined ? on_button_down : button_on_button_down);
		button_on_button_up = (on_button_up != undefined ? on_button_up : button_on_button_up);
		button_touch_out_padding = (padding != undefined ? padding : button_touch_out_padding);
	}
	
	return button;
})