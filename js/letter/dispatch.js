// generic update list, delayed dispatch, and global named event handling
// copyright 2020 Samuel Baird MIT Licence

// -- update list --------------------------------------------------------------------
// collection with tag/callback/expire behaviour

class update_list {
	constructor () {
		this.list = [];

		// control updates during iteration
		this.is_iterating = false;
		this.iteration_index = 0;

		// these are only create if an interruption to fast path occurs
		this.slow_path_to_complete = null;
		this.slow_path_to_ignore = null;
	}

	add (obj, tag) {
		// capture the slow path here before objects are added this update cycle
		this.enable_slow_path_iteration_if_required();

		this.list.push({
			obj: obj,
			tag: tag,
		});
	}

	remove (obj_or_tag) {
		// cancel the fast path if we're in an iteration
		this.enable_slow_path_iteration_if_required();

		let did_remove = false;
		let i = 0;
		while (i < this.list.length) {
			const entry = this.list[i];
			if (entry.obj == obj_or_tag || entry.tag == obj_or_tag) {
				this.list.splice(i, 1);
				did_remove = true;
			} else {
				i++;
			}
		}

		return did_remove;
	}

	clear () {
		// cancel the fast path if we're in an iteration
		this.enable_slow_path_iteration_if_required();

		// clear our actual list
		this.list = [];
	}

	is_clear () {
		return this.list.length == 0;
	}

	update (update_function, remove_on_return_true) {
		// if we're already in an iteration, don't allow it to recurse
		if (this.is_iterating) {
			return;
		}

		// markers to begin the iteration in fast path
		this.is_iterating = true;

		// begin on a fast path, iterating by index and removing complete updates as required
		// avoid creation of temporary objects unless update during iteration requires it
		let i = 0;
		let length = this.list.length;
		while (i < length && this.slow_path_to_complete == null) {
			// save this marker in case we drop off the fast path
			this.iteration_index = i;

			// check this entry, update and remove if required
			const entry = this.list[i];
			if (update_function(entry.obj) === true && remove_on_return_true) {
				// if we've jumped onto the slow path during the update then be careful here
				if (this.slow_path_to_complete != null) {
					const post_update_index = this.list.indexOf(entry);
					if (post_update_index >= 0) {
						this.list.splice(post_update_index, 1);
					}
				} else {
					this.list.splice(i, 1);
					length--;
				}
			} else {
				i++;
			}
		}

		// if we've dropped off the fast path then complete the iteration on the slow path
		if (this.slow_path_to_complete != null) {
			// complete all that haven't been removed since we started the slow path
			for (const entry of this.slow_path_to_complete) {
				// first check this entry is still in the real list
				const current_index = this.list.indexOf(entry);
				if (current_index >= 0) {
					if (update_function(entry.obj) === true && remove_on_return_true) {
						// find and remove it from the original list, if its still in after the update function
						const post_update_index = this.list.indexOf(entry);
						if (post_update_index >= 0) {
							this.list.splice(post_update_index, 1);
						}
					}
				}
			}
		}

		// clear flags and data that can be accumulated during iteration
		this.slow_path_to_complete = null;
		this.is_iterating = false;
	}

	enable_slow_path_iteration_if_required () {
		// only do this if we haven't already for this iteration
		if (!this.is_iterating || this.slow_path_to_complete != null) {
			return;
		}

		// capture a copy of everything we need to complete on the remainder of the fast path
		this.slow_path_to_complete = [];
		for (let i = this.iteration_index + 1; i < this.list.length; i++) {
			this.slow_path_to_complete.push(this.list[i]);
		}
	}

	clone_update (update_function, remove_on_return_true) {
		const clone = this.list.concat();
		for (const entry of clone) {
			if (update_function(entry.obj) === true && remove_on_return_true) {
				const index = this.list.indexOf(entry);
				if (index > -1) {
					this.list.splice(index, 1);
				}
			}
		}
	}
}

// -- frame dispatch --------------------------------------------------------------------
// attach functions to delay or repeat around a frame timer

// how to handle dispatching each entry
const frame_dispatch_update_function = function (entry) {
	if (entry.repeat_fn) {
		entry.repeat_fn();
	}
	if (entry.count && entry.count > 0) {
		if (--entry.count == 0) {
			if (entry.delay_fn) {
				entry.delay_fn();
			}
			// finished now
			return true;
		}
	}
	return false;
};

class frame_dispatch {

	constructor () {
		this.update_list = new update_list();
	}

	// do this after a delay
	delay (count, fn, tag) {
		this.update_list.add({
			type : 'delay',
			count : count,
			delay_fn : fn,
		}, tag);
	}

	// repeat this a number of times
	recur (count, fn, tag) {
		this.update_list.add({
			type : 'recur',
			count : count,
			repeat_fn : fn,
		}, tag);
	}

	// call this every time
	hook (fn, tag) {
		this.recur(-1, fn, tag);
	}

	// call this once only
	once (fn, tag) {
		this.recur(1, fn, tag);
	}

	update () {
		this.update_list.update(frame_dispatch_update_function, true);
	}

	// proxy through some methods from the update_list
	clear () {
		this.update_list.clear();
	}

	is_clear () {
		return this.update_list.is_clear();
	}

	remove (tag_or_fn) {
		this.update_list.remove(tag_or_fn);
	}

	dispose () {
		this.clear();
	}
}

// an event system in 3 parts, an event server (event_dispatch), an event client (event_handler)
// and some methods to share a static reference to a global default event dispatcher
// used to defer touch events and dispatch them at a predictable moment during the frame cycle
// copyright 2020 Samuel Baird MIT Licence

class event_dispatch {

	constructor () {
		this.events = new Map();
		this.deferred = [];
	}

	add_listener (tag, event_name, action) {
		let listeners = this.events.get(event_name);
		if (listeners == undefined) {
			listeners = [];
			this.events.set(event_name, listeners);
		}
		listeners.push({
			tag : tag,
			action : action,
		});
	}

	remove_listener (tag, event_name) {
		if (event_name == undefined) {
			for (const [name] of this.events) {
				this.remove_listener(tag, name);
			}
			return;
		}

		const listeners = this.events.get(event_name);
		if (listeners && listeners.constructor === Array && listeners.length > 0) {
			let i = listeners.length;
			while (--i >= 0) {
				const listener = listeners[i];
				if (listener.tag == tag) {
					listeners.splice(i, 1);
				}
			}
		}
	}

	remove_all () {
		this.events = new Map();
	}

	dispatch (event_name, data) {
		const listeners = this.events.get(event_name);
		if (listeners && listeners.length > 0) {
			// clone and iterate the cloned array to
			const clone = listeners.concat();
			for (let i = 0; i < clone.length; i++) {
				const listener = clone[i];
				if (listener.action) {
					listener.action(data);
				}
			}
		}
	}

	defer (event_name, data) {
		this.deferred.push({
			event_name : event_name,
			data : data,
		});
	}

	dispatch_deferred () {
		const current = this.deferred;
		this.deferred = [];
		for (let i = 0; i < current.length; i++) {
			const def = current[i];
			this.dispatch(def.event_name, def.data);
		}
	}

	clear_deferred () {
		this.deferred = [];
	}

	dispose () {
		this.clear_deferred();
		this.remove_all();
	}

}

class event_handler {

	constructor (dispatch) {
		this.event_dispatch = dispatch;
		this.did_listen = false;
	}

	listen (event_name, action) {
		this.did_listen = true;
		this.event_dispatch.add_listener(this, event_name, action);
	}

	unlisten (event_name) {
		this.event_dispatch.remove_listener(this, event_name);
		if (event_name == undefined) {
			this.did_listen = false;
		}
	}

	dispatch (event_name, data) {
		this.event_dispatch.dispatch(event_name, data);
	}

	defer (event_name, data) {
		this.event_dispatch.defer(event_name, data);
	}

	dispose () {
		if (this.did_listen) {
			this.unlisten();
		}
	}
}

// a dispatch.context is a sort of execution context for objects within an app
// tying ui and delay action elements to a particular spot within the app_node tree
// often the root app

class context {

	constructor (parent) {
		this.parent = parent;
		this.current = this;
		this.root = (parent != null) ? parent.root : this;

		// which derivatives of this context are more current than this one
		this.current_stack = [];

		// the dispatch and flags that are set at this level
		this.frame_dispatch = new frame_dispatch();
		this.event_dispatch = new event_dispatch();
		this.flags = new Map();
	}

	update () {
		this.frame_dispatch.update();
		this.event_dispatch.dispatch_deferred();
	}

	reset () {
		this.frame_dispatch.clear();
		this.event_dispatch.clear_deferred();

	}

	set (name, value) {
		this.flags.set(name, value);
	}

	get (name, default_value = null) {
		if (this.flags[name]) {
			return this.flags[name];
		}
		if (this.parent) {
			return this.parent.get(name);
		}
		return default_value;
	}

	/*
	derive (active) {
		const derived = new context(this);
		if (active) {

		}
		return derived;
	}
	*/

	/* TODO: work out what to do with this
	activate () {
		if (this.active) {
			// TODO: move to the front of the queue in the parent
			return;
		}

		// add to the parent derived
		this.active = true;

		// override on the parent
		// 			this.event_dispatch.clear_deferred();
	}

	deactivate () {
		// TODO deactivate context event
		// disable (and send a cancel all message to all listeners)

		this.active = false;

	}
	*/

	get_active () {
		// if no derived have taken over then this context is current
		if (this.current_stack.length == 0) {
			return this;
		}

		// otherwise defer to the most recent derived
		return this.current_stack[this.current_stack.length - 1].get_active();
	}

	dispose () {
		this.deactivate();
		if (this.frame_dispatch) {
			this.frame_dispatch.dispose();
			this.frame_dispatch = null;
		}
		if (this.event_dispatch) {
			this.event_dispatch.dispose();
			this.event_dispatch = null;
		}
	}
}

export const event_activate_context = 'event_activate_context';
export const event_deactivate_context = 'event_deactivate_context';

export { update_list, frame_dispatch, event_dispatch, event_handler, context };