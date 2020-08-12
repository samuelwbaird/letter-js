// manage a touch area over a display list transform from event dispatch
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from  './geometry.js';
import * as dispatch from './dispatch.js';
import * as display from  './display.js';

class touch_area {

	constructor (point_conversion, area_test, selected_event_dispatch) {
		this.point_conversion = point_conversion;
		this.area_test = area_test;
		this.event_handler = new dispatch.event_handler(selected_event_dispatch);
		this.enabled = true;

		// initialise values
		this.cancel_touch();

		// clients should supply these
		this.on_touch_begin = null;
		this.on_touch_move = null;
		this.on_touch_end = null;
	}

	cancel_touch () {
		this.is_touched = false;
		this.is_touch_over = false;
		this.touch_id = null;

		this.touch_time = null;
		this.touch_position = null;

		this.touch_start_time = null;
		this.touch_start_position = null;

		this.drag_distance = null;
		this.move_distance = null;
	}

	get enabled () {
		return this.event_handler.did_listen;
	}

	set enabled (value) {
		if (value && !this.event_handler.did_listen) {
			this.event_handler.listen('touch_begin', (touch_data) => {
				this.handle_touch_begin(touch_data);
			});
			this.event_handler.listen('touch_move', (touch_data) => {
				this.handle_touch_move(touch_data);
			});
			this.event_handler.listen('touch_end', (touch_data) => {
				this.handle_touch_end(touch_data);
			});
			this.event_handler.listen('touch_end', (touch_data) => {
				this.handle_touch_cancel(touch_data);
			});
		} else if (!value && this.event_handler.did_listen) {
			this.event_handler.unlisten();
			this.cancel_touch();
		}
	}

	handle_touch_begin (touch_data) {
		if (this.touch_id) {
			return;
		}			// already tracking a touch
		if (!this.point_conversion) {
			return;
		}	// no longer valid

		const point = this.point_conversion(touch_data);
		const is_touch_over = this.area_test(point);

		if (!is_touch_over) {
			return;
		}

		// -- TODO: check for filtering and intercepts here
		this.is_touched = true;
		this.is_touch_over = true;
		this.touch_id = touch_data.id;

		this.touch_position = point;
		this.touch_time = touch_data.time;

		this.touch_start_position = { x : point.x, y : point.y };
		this.touch_start_time = this.touch_time;

		this.drag_distance = null;
		this.move_distance = null;

		if (this.on_touch_begin) {
			this.on_touch_begin(this);
		}
	}

	handle_touch_move (touch_data) {
		if (this.touch_id != touch_data.id) {
			return;
		}

		this.update_values(this.point_conversion(touch_data), touch_data.time);
		if (this.on_touch_move) {
			this.on_touch_move(this);
		}
	}

	handle_touch_end (touch_data) {
		if (this.touch_id != touch_data.id) {
			return;
		}

		this.update_values(this.point_conversion(touch_data), touch_data.time);
		if (this.on_touch_end) {
			this.on_touch_end(this);
		}
		this.cancel_touch();
	}

	handle_touch_cancel (touch_data) {
		if (this.touch_id != touch_data.id) {
			return;
		}
		this.cancel_touch();
	}

	update_values (point, time) {
		const previous_position = this.touch_position;
		this.is_touch_over = this.area_test(point);
		this.touch_position = point;
		this.touch_time = time;

		this.drag_distance = { x : point.x - this.touch_start_position.x, y : point.y - this.touch_start_position.y };
		this.move_distance = { x : point.x - previous_position.x, y : point.y - previous_position.y };
	}

	dispose () {
		if (this.event_handler) {
			this.event_handler.dispose();
			this.event_handler = null;
		}
		this.on_touch_begin = null;
		this.on_touch_move = null;
		this.on_touch_end = null;
	}


	// add static constructors
	static bounds (display_object, padding, selected_event_dispatch) {
		if (padding == undefined) {
			padding = 0;
		}
		return new touch_area(
			// point conversion
			((point) => {
				return display_object.world_to_local(point);
			}),
			// area test
			((point) => {
				let rect = display_object.bounds();
				rect = geometry.expanded_rect(rect, padding, padding);
				return rect.contains_point(point);
			}),
			selected_event_dispatch
		);
	}

	static rect (display_object, rect, selected_event_dispatch) {
		return new touch_area(
			// point conversion
			((point) => {
				return display_object.world_to_local(point);
			}),
			// area test
			((point) => {
				return rect.contains_point(point);
			}),
			selected_event_dispatch
		);
	}
}


// adds two frame button behaviour to an animated display object
// copyright 2020 Samuel Baird MIT Licence

// -- configure these with later static method ---------

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
			this.handle_button_release();
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

class canvas_screen  {
	constructor (canvas, ideal_width, ideal_height, fit) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.ideal_height = ideal_height;
		this.ideal_width = ideal_width;
		this.fit = fit;
		this.root_view = new display.display_list();

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
				dispatch.shared_event_dispatch().defer(event_name, { id : touch.identifier, time : Date.now, x : (touch.pageX - this.canvas.offsetLeft) * scale_x, y : (touch.pageY - this.canvas.offsetTop) * scale_y });
			}
		} else {
			dispatch.shared_event_dispatch().defer(event_name, { id : 1, time : Date.now, x : (evt.pageX - this.canvas.offsetLeft) * scale_x, y : (evt.pageY - this.canvas.offsetTop) * scale_y });
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
		this.root_view.render(this.ctx, geometry.transform.identity());
	}
}

class render_callback {
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
		this.delta = 1 / fps;
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

export { touch_area, button, canvas_screen, render_callback, fixed_rate_timer };
