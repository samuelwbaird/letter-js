// adds two frame button behaviour to an animated display object
// copyright 2020 Samuel Baird MIT Licence

import * as touch_area from  './touch_area.js';

// configure these with later static method

// static method used to dispatch button actions
// replace with a method that delays by 1 frame to allow visual button update
let button_action_callback = (action) => {
	action();
};
// override these functions to provide universal button click sounds if required
let button_on_button_down = function () {};
let button_on_button_up = function () {};
// how much extra logical space to allow on the outer touch area
let button_touch_out_padding = 20;

class button {

	constructor (clip, action, event_dispatch, init_values) {
		// base properties for a button
		this.clip = clip;
		this.action = action;
		this.event_dispatch = event_dispatch;

		// override these properties if required
		if (clip.goto != null) {
			// if the clip appears to be an animated clip then default to using these frames as the button states
			this.up_frame = 1;
			this.down_frame = 2;
		}

		if (init_values) {
			for (const k in init_values) {
				this[k] = init_values[k];
			}
		}

		// internal
		this.is_down = false;
		this.is_releasing = false;

		this.touch_area_inner = touch_area.bounds(clip, 0, event_dispatch);
		this.touch_area_outer = touch_area.bounds(clip, button_touch_out_padding, event_dispatch);

		this.touch_area_inner.on_touch_begin = () => {
			this.update();
		};
		this.touch_area_inner.on_touch_move = () => {
			this.update();
		};
		this.touch_area_inner.on_touch_end = () => {
			this.update();
		};
		this.touch_area_outer.on_touch_begin = () => {
			this.update();
		};
		this.touch_area_outer.on_touch_move = () => {
			this.update();
		};
		this.touch_area_outer.on_touch_end = () => {
			this.update();
		};
	}

	get enabled () {
		return this.touch_area_inner.enabled && this.touch_area_outer.enabled;
	}

	set enabled (value) {
		if (this.touch_area_inner) {
			this.touch_area_inner.enabled = value;
			this.touch_area_outer.enabled = value;
		}
		this.update();
	}

	is_visible () {
		return this.clip.is_visible();
	}

	update () {
		if (this.enabled && this.is_visible() && this.touch_area_inner.is_touched && this.touch_area_outer.is_touch_over && !this.is_releasing) {
			if (!this.is_down) {
				this.is_down = true;
				button_on_button_down(this);
				if (typeof this.down_frame == 'function') {
					this.down_frame(this);
				} else if (this.clip.goto != null) {
					this.clip.goto(this.down_frame);
				}
			}
		} else {
			if (this.is_down) {
				this.is_down = false;
				button_on_button_up(this);
				if (typeof this.up_frame == 'function') {
					this.up_frame(this);
				} else if (this.clip.goto != null) {
					this.clip.goto(this.up_frame);
				}
			}
		}

	}

	handle_button_release () {
		if (this.is_releasing) {
			return;
		}

		if (this.is_down) {
			this.is_releasing = true;
			this.update();

			button_action_callback(() => {
				this.action(this);
				this.is_releasing = false;
			});
		}
	}

	cancel_touch () {
		if (this.is_releasing) {
			return;
		}

		if (this.touch_area_inner) {
			this.touch_area_inner.cancel_touch();
		}
		if (this.touch_area_outer) {
			this.touch_area_outer.cancel_touch();
		}
		this.update();
	}

	dispose () {
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

	static configure (delayed_action, on_button_up, on_button_down, padding) {
		button_action_callback = delayed_action;
		button_on_button_down = (on_button_down != undefined ? on_button_down : button_on_button_down);
		button_on_button_up = (on_button_up != undefined ? on_button_up : button_on_button_up);
		button_touch_out_padding = (padding != undefined ? padding : button_touch_out_padding);
	}
}

export default button;