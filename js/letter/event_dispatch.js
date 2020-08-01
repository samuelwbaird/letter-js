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

function shared_instance () {
	return shared[shared.length - 1];
}

function reset_shared_instance () {
	shared = [new event_dispatch()];
}

function push_shared_instance () {
	shared.push(new event_dispatch());
}

function pop_shared_instance () {
	return shared.pop();
}

export { event_dispatch, event_handler, shared_instance, reset_shared_instance, push_shared_instance, pop_shared_instance };