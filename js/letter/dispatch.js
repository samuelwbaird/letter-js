'use strict';
// an object to manage dispatch of events on integer frame numbers
// copyright 2016 Samuel Baird MIT Licence

define([], function () {
	
	var frame_dispatch = klass(function (frame_dispatch) {
		
		frame_dispatch.init = function () {
			this.update_list = new update_list();
		}
		
		// do this after a delay
		frame_dispatch.delay = function (count, fn, tag) {
			this.update_list.add({
				type : 'delay',
				count : count,
				delay_fn : fn,
			}, tag)
		}
	
		// repeat this a number of times
		frame_dispatch.recur = function (count, fn, tag) {
			this.update_list.add({
				type : 'recur',
				count : count,
				repeat_fn : fn,
			}, tag)
		}
	
		// call this every time
		frame_dispatch.hook = function (fn, tag) {
			this.recur(-1, fn, tag)
		}
	
		// call this once only
		frame_dispatch.once = function (fn, tag) {
			this.recur(1, fn, tag)
		}
	
		// update, next round of dispatch/tick/frame
		var update_function = function (entry) {
			if (entry.repeat_fn) {
				entry.repeat_fn();
			}
			if (entry.count && entry.count > 0) {
				entry.count = entry.count - 1;
				if (entry.count == 0) {
					if (entry.delay_fn) {
						entry.delay_fn()
					}
					// finished now
					return true
				}
			}
			return false;
		}
		
		frame_dispatch.update = function () {
			this.update_list.update(update_function);
		}
		
		// proxy through some methods from the update_list
		frame_dispatch.clear = function () {
			this.update_list.clear()
		}
	
		frame_dispatch.is_clear = function () {
			return this.update_list.is_clear()
		}
	
		frame_dispatch.remove = function (tag_or_fn) {
			this.update_list.remove(tag_or_fn)
		}
		
	});
	
	return {
		frame_dispatch : frame_dispatch
	}
})
