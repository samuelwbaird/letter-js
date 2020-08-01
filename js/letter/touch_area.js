// manage a touch area over a display list transform from event dispatch
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from  './geometry.js';
import * as event_dispatch from './event_dispatch.js';

class touch_area {

	constructor (point_conversion, area_test, selected_event_dispatch) {
		this.point_conversion = point_conversion;
		this.area_test = area_test;
		this.event_handler = new event_dispatch.event_handler(selected_event_dispatch);
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

export { touch_area };
export default touch_area;