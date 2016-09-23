'use strict';
// an event system in 3 parts, an event server (event_dispatch), an event client (event_handler)
// and some methods to share a static reference to a global default event dispatcher
// used to defer touch events and dispatch them at a predictable moment during the frame cycle
// copyright 2016 Samuel Baird MIT Licence

define([], function () {	
	var event_dispatch = klass(function (event_dispatch) {
		event_dispatch.init = function () {
			this.events = {};
			this.deferred = [];
		}
		
		event_dispatch.add_listener = function (tag, event_name, action) {
			var listeners = this.events[event_name];
			if (listeners == undefined) {
				listeners = [];
				this.events[event_name] = listeners;
			}
			listeners.push({
				tag : tag,
				action : action
			});
		}
		
		event_dispatch.remove_listener = function (tag, event_name) {
			if (event_name == undefined) {
				for (name in this.events) {
					this.remove_listener(name);
				}
				return;
			}
			
			var listeners = this.events[event_name];
			if (listeners && listeners.length > 0) {
				var i = listeners.length;
				while (--i >= 0) {
					var listener = listeners[i];
					if (listener.tag == tag) {
						listeners.splice(i, 1);
					}
				}
			}
		}
		
		event_dispatch.remove_all = function () {
			this.events = {};
		}
		
		event_dispatch.dispatch = function (event_name, data) {
			var listeners = this.events[event_name];
			if (listeners && listeners.length > 0) {
				// clone and iterate the cloned array to 
				var clone = listeners.slice();
				for (var i = 0; i < clone.length; i++) {
					var listener = clone[i];
					if (listener.action) {
						listener.action(data);
					}
				}
			}
		}
		
		event_dispatch.defer = function (event_name, data) {
			this.deferred.push({
				event_name : event_name,
				data : data
			})
		}
		
		event_dispatch.dispatch_deferred = function () {
			var current = this.deferred;
			this.deferred = [];
			for (var i = 0; i < current.length; i++) {
				var def = current[i];
				this.dispatch(def.event_name, def.data);
			}
		}

	});
	
	var shared = [ new event_dispatch() ];
	
	var event_handler = klass(function (event_handler) {
		
		event_handler.init = function (dispatch) {
			this.event_dispatch = (dispatch != null ? dispatch : shared[shared.length - 1]);
			this.did_listen = false;
		}
		
		event_handler.listen = function (event_name, action) {
			this.did_listen = true;
			this.event_dispatch.add_listener(this, event_name, action);
		}
		
		event_handler.unlisten = function (event_name) {
			this.event_dispatch.remove_listener(this, event_name);
			if (event_name == undefined) {
				this.did_listen = false;
			}
		}
		
		event_handler.dispatch = function (event_name, data) {
			this.event_dispatch.dispatch(event_name, data);
		}
		
		event_handler.defer = function (event_name, data) {
			this.event_dispatch.defer(event_name, data);
		}
		
		event_handler.dispose = function () {
			if (this.did_listen) {
				this.unlisten();
			}
		}
		
	});
	
	return {
		event_dispatch : event_dispatch,
		event_handler : event_handler,
		
		shared_instance : function () {
			return shared[shared.length - 1];
		},
		reset_shared_instance : function () {
			shared = [ new event_dispatch() ];
		},
		push_shared_instance : function () {
			shared.push(new event_dispatch());
		},
		pop_shared_instance : function () {
			return shared.pop();
		}
	}
})