'use strict';
// manage a touch area over a display list transform from event dispatch
// copyright 2016 Samuel Baird MIT Licence

define(['letter.event_dispatch', 'letter.geometry'], function (event_dispatch, geometry) {
	var touch_area = klass(function (touch_area) {
		
		touch_area.init = function(point_conversion, area_test, selected_event_dispatch) {
			this.point_conversion = point_conversion;
			this.area_test = area_test;
			this.event_handler = new event_dispatch.event_handler(selected_event_dispatch);
			this.set_enabled(true);
			
			// initialise values
			this.cancel_touch();
	
			// clients should supply these
			this.on_touch_begin = null
			this.on_touch_move = null
			this.on_touch_end = null
		}
		
		touch_area.cancel_touch = function () {
			this.is_touched = false
			this.is_touch_over = false
			this.touch_id = null
	
			this.touch_time = null
			this.touch_position = null
	
			this.touch_start_time = null
			this.touch_start_position = null
	
			this.drag_distance = null
			this.move_distance = null
		}
		
		touch_area.get_enabled = function () {
			return this.event_handler.did_listen;
		}
		
		touch_area.set_enabled = function (value) {
			if (value && !this.event_handler.did_listen) {
				var self = this;
				this.event_handler.listen('touch_begin', function (touch_data) {
					self.handle_touch_begin(touch_data)
				})
				this.event_handler.listen('touch_move', function (touch_data) {
					self.handle_touch_move(touch_data)
				})
				this.event_handler.listen('touch_end', function (touch_data) {
					self.handle_touch_end(touch_data)
				})
				this.event_handler.listen('touch_end', function (touch_data) {
					self.handle_touch_cancel(touch_data)
				})
			} else if (!value && this.event_handler.did_listen) {
				this.event_handler.unlisten();
				this.cancel_touch();
			}
		}
		
		touch_area.handle_touch_begin = function (touch_data) {
			if (this.touch_id) { return; };			// already tracking a touch
			if (!this.point_conversion) { return; }	// no longer valid
			
			var point = this.point_conversion(touch_data);
			var is_touch_over = this.area_test(point);
			
			if (!is_touch_over) { return; }
			
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
		
		touch_area.handle_touch_move = function (touch_data) {
			if (this.touch_id != touch_data.id) { return; }

			this.update_values(this.point_conversion(touch_data), touch_data.time);
			if (this.on_touch_move) {
				this.on_touch_move(this);
			}
		}
		
		touch_area.handle_touch_end = function (touch_data) {
			if (this.touch_id != touch_data.id) { return; }

			this.update_values(this.point_conversion(touch_data), touch_data.time);
			if (this.on_touch_end) {
				this.on_touch_end(this);
			}
			this.cancel_touch();
		}
		
		touch_area.handle_touch_cancel = function (touch_data) {
			if (this.touch_id != touch_data.id) { return; }
			this.cancel_touch();
		}
		
		touch_area.update_values = function (point, time) {
			var previous_position = this.touch_position;
			this.is_touch_over = this.area_test(point);
			this.touch_position = point;
			this.touch_time = time;
			
			this.drag_distance = { x : point.x - this.touch_start_position.x, y : point.y - this.touch_start_position.y }
			this.move_distance = { x : point.x - previous_position.x, y : point.y - previous_position.y }
		}
		
		touch_area.dispose = function () {
			if (this.event_handler) {
				this.event_handler.dispose();
				this.event_handler = null;
			}
			this.on_touch_begin = null;
			this.on_touch_move = null;
			this.on_touch_end = null;
		}
	});
	
	// add static constructors
	touch_area.bounds = function (display_object, padding, selected_event_dispatch) {
		if (padding == undefined) { padding = 0; }
		return new touch_area(
			// point conversion
			function (point) { return display_object.world_to_local(point); },
			// area test
			function (point) {
				var rect = display_object.bounds();
				rect = geometry.rect_expand(rect, padding, padding);
				return geometry.rect_contains_point(rect, point);
			},
			selected_event_dispatch
		);
	}
	
	touch_area.rect = function (display_object, rect, selected_event_dispatch) {
		return new touch_area(
			// point conversion
			function (point) { return display_object.world_to_local(point); },
			// area test
			function (point) {
				return geometry.rect_contains_point(rect, point);
			},
			selected_event_dispatch
		);
	}
		
	return touch_area;
})