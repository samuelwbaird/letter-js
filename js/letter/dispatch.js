// basic geometry types to be reused across all other letter modules
// copyright 2020 Samuel Baird MIT Licence

// -- update list --------------------------------------------------------------------
// collection with tag/callback/expire behaviour

class update_list {
	constructor () {
		this.list = [];
	}

	add (obj, tag) {
		this.list.push({
			obj: obj,
			tag: tag,
		});
	}

	remove (obj_or_tag) {
		if (this.is_iterating) {
			throw 'remove during update/iteration';
		}

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
		if (this.is_iterating) {
			throw 'clear during update/iteration';
		}
		this.list = [];
	}

	is_clear () {
		return this.list.length == 0;
	}

	update (update_function, remove_on_return_true) {
		if (this.is_iterating) {
			throw 'update during update/iteration';
		}
		this.is_iterating = true;
		let i = 0;
		let length = this.list.length;
		while (i < length) {
			const entry = this.list[i];
			if (update_function(entry.obj) === true && remove_on_return_true) {
				this.list.splice(i, 1);
				length--;
			} else {
				i++;
			}
		}
		this.is_iterating = false;
	}

	safe_update (update_function, remove_on_return_true) {
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

	safe_update () {
		this.update_list.safe_update(frame_dispatch_update_function, true);
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
}

let shared = [new event_dispatch()];

class event_handler {

	constructor (dispatch) {
		this.event_dispatch = (dispatch != null ? dispatch : shared[shared.length - 1]);
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

function shared_event_dispatch () {
	return shared[shared.length - 1];
}

function reset_shared_event_dispatch () {
	shared = [new event_dispatch()];
}

function push_shared_event_dispatch () {
	shared.push(new event_dispatch());
}

function pop_shared_event_dispatch () {
	return shared.pop();
}

export { update_list, frame_dispatch, event_dispatch, event_handler, shared_event_dispatch, reset_shared_event_dispatch, push_shared_event_dispatch, pop_shared_event_dispatch };