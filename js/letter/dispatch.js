// generic update list, delayed dispatch, and global named event handling
// copyright 2020 Samuel Baird MIT Licence

// -- update list --------------------------------------------------------------------
// collection with tag/callback/expire behaviour

class UpdateList {
	constructor () {
		this.list = [];

		// control updates during iteration
		this.isIterating = false;
		this.iterationIndex = 0;

		// these are only create if an interruption to fast path occurs
		this.slowPathToComplete = null;
		this.slowPathToIgnore = null;
	}

	add (obj, tag) {
		// capture the slow path here before objects are added this update cycle
		this.enableSlowPathIterationIfRequired();

		this.list.push({
			obj: obj,
			tag: tag,
		});
	}

	remove (objOrTag) {
		// cancel the fast path if we're in an iteration
		this.enableSlowPathIterationIfRequired();

		let didRemove = false;
		let i = 0;
		while (i < this.list.length) {
			const entry = this.list[i];
			if (entry.obj == objOrTag || entry.tag == objOrTag) {
				this.list.splice(i, 1);
				didRemove = true;
			} else {
				i++;
			}
		}

		return didRemove;
	}

	clear () {
		// cancel the fast path if we're in an iteration
		this.enableSlowPathIterationIfRequired();

		// clear our actual list
		this.list = [];
	}

	isClear () {
		return this.list.length == 0;
	}

	first () {
		return this.list[0].obj;
	}

	last () {
		return this.list[this.list.length - 1].obj;
	}

	update (updateFunction, removeONReturnTrue) {
		// if we're already in an iteration, don't allow it to recurse
		if (this.isIterating) {
			return;
		}

		// markers to begin the iteration in fast path
		this.isIterating = true;

		// begin on a fast path, iterating by index and removing complete updates as required
		// avoid creation of temporary objects unless update during iteration requires it
		let i = 0;
		let length = this.list.length;
		while (i < length && this.slowPathToComplete == null) {
			// save this marker in case we drop off the fast path
			this.iterationIndex = i;

			// check this entry, update and remove if required
			const entry = this.list[i];
			if (updateFunction(entry.obj) === true && removeONReturnTrue) {
				// if we've jumped onto the slow path during the update then be careful here
				if (this.slowPathToComplete != null) {
					const postUpdateIndex = this.list.indexOf(entry);
					if (postUpdateIndex >= 0) {
						this.list.splice(postUpdateIndex, 1);
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
		if (this.slowPathToComplete != null) {
			// complete all that haven't been removed since we started the slow path
			for (const entry of this.slowPathToComplete) {
				// first check this entry is still in the real list
				const currentIndex = this.list.indexOf(entry);
				if (currentIndex >= 0) {
					if (updateFunction(entry.obj) === true && removeONReturnTrue) {
						// find and remove it from the original list, if its still in after the update function
						const postUpdateIndex = this.list.indexOf(entry);
						if (postUpdateIndex >= 0) {
							this.list.splice(postUpdateIndex, 1);
						}
					}
				}
			}
		}

		// clear flags and data that can be accumulated during iteration
		this.slowPathToComplete = null;
		this.isIterating = false;
	}

	enableSlowPathIterationIfRequired () {
		// only do this if we haven't already for this iteration
		if (!this.isIterating || this.slowPathToComplete != null) {
			return;
		}

		// capture a copy of everything we need to complete on the remainder of the fast path
		this.slowPathToComplete = [];
		for (let i = this.iterationIndex + 1; i < this.list.length; i++) {
			this.slowPathToComplete.push(this.list[i]);
		}
	}

	cloneUpdate (updateFunction, removeONReturnTrue) {
		const clone = this.list.concat();
		for (const entry of clone) {
			if (updateFunction(entry.obj) === true && removeONReturnTrue) {
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
const frameDispatchUpdateFunction = function (entry) {
	if (entry.repeatFn) {
		entry.repeatFn();
	}
	if (entry.count && entry.count > 0) {
		if (--entry.count == 0) {
			if (entry.delayFn) {
				entry.delayFn();
			}
			// finished now
			return true;
		}
	}
	return false;
};

class FrameDispatch {

	constructor () {
		this.updateList = new UpdateList();
	}

	// do this after a delay
	delay (count, fn, tag) {
		count = Math.floor(count);
		if (count <= 0) {
			count = 1;
		}

		this.updateList.add({
			type : 'delay',
			count : count,
			delayFn : fn,
		}, tag);
	}

	// repeat this a number of times
	recur (count, fn, tag) {
		count = Math.floor(count);
		if (count <= 0) {
			return;
		}

		this.updateList.add({
			type : 'recur',
			count : count,
			repeatFn : fn,
		}, tag);
	}

	// call this every time
	hook (fn, tag) {
		this.updateList.add({
			type : 'recur',
			count : -1,		// infinite repeat
			repeatFn : fn,
		}, tag);
	}

	// call this once only
	once (fn, tag) {
		this.recur(1, fn, tag);
	}

	update () {
		this.updateList.update(frameDispatchUpdateFunction, true);
	}

	// proxy through some methods from the updateList
	clear () {
		this.updateList.clear();
	}

	isClear () {
		return this.updateList.isClear();
	}

	remove (tagOrFn) {
		this.updateList.remove(tagOrFn);
	}

	dispose () {
		this.clear();
	}
}

// an event system in 3 parts, an event server (eventDispatch), an event client (eventHandler)
// and some methods to share a static reference to a global default event dispatcher
// used to defer touch events and dispatch them at a predictable moment during the frame cycle
// copyright 2020 Samuel Baird MIT Licence

class EventDispatch {

	constructor () {
		this.events = new Map();
		this.deferred = [];
	}

	addListener (tag, eventName, action) {
		if (eventName == undefined) {
			throw 'cannot add listener with undefined event name';
		}

		let listeners = this.events.get(eventName);
		if (listeners == undefined) {
			listeners = [];
			this.events.set(eventName, listeners);
		}
		listeners.push({
			tag : tag,
			action : action,
		});
	}

	removeListener (tag, eventName) {
		if (eventName == undefined) {
			for (const [name] of this.events) {
				this.removeListener(tag, name);
			}
			return;
		}

		const listeners = this.events.get(eventName);
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

	removeAll () {
		this.events = new Map();
	}

	dispatch (eventName, data) {
		const listeners = this.events.get(eventName);
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

	defer (eventName, data) {
		this.deferred.push({
			eventName : eventName,
			data : data,
		});
	}

	dispatchDeferred () {
		const current = this.deferred;
		this.deferred = [];
		for (let i = 0; i < current.length; i++) {
			const def = current[i];
			this.dispatch(def.eventName, def.data);
		}
	}

	clearDeferred () {
		this.deferred = [];
	}

	dispose () {
		this.clearDeferred();
		this.removeAll();
	}

}

class EventHandler {

	constructor (dispatch) {
		this.eventDispatch = dispatch;
		this.didListen = false;
	}

	listen (eventName, action) {
		this.didListen = true;
		this.eventDispatch.addListener(this, eventName, action);
	}

	unlisten (eventName) {
		this.eventDispatch.removeListener(this, eventName);
		if (eventName == undefined) {
			this.didListen = false;
		}
	}

	dispatch (eventName, data) {
		this.eventDispatch.dispatch(eventName, data);
	}

	defer (eventName, data) {
		this.eventDispatch.defer(eventName, data);
	}

	dispose () {
		if (this.didListen) {
			this.unlisten();
		}
	}
}

// a dispatch.context is a sort of execution context for objects within an app
// tying ui and delay action elements to a particular spot within the appNode tree
// often the root app

class Context {

	constructor (parent) {
		this.parent = parent;
		this.current = this;
		this.root = (parent != null) ? parent.root : this;

		// which derivatives of this context are more current than this one
		this.derivatives = new UpdateList();

		// the dispatch and flags that are set at this level
		this.frameDispatch = new FrameDispatch();
		this.eventDispatch = new EventDispatch();
		this.flags = new Map();
	}

	root () {
		if (this.parent != null) {
			return this.parent.root();
		} else {
			return this;
		}
	}

	update () {
		this.frameDispatch.update();
		this.eventDispatch.dispatchDeferred();
	}

	reset () {
		this.frameDispatch.clear();
		this.eventDispatch.clearDeferred();
	}

	set (name, value) {
		this.flags.set(name, value);
	}

	get (name, defaultValue = null) {
		if (this.flags.has(name)) {
			return this.flags.get(name);
		}
		if (this.parent) {
			return this.parent.get(name);
		}
		return defaultValue;
	}

	derive () {
		const derived = new Context(this);
		this.derivatives.add(derived);
		// this automatically becomes active, cancel interactions in play on all other contexts
		this.root.interrupt(derived);
		return derived;
	}

	getActive () {
		// if no derived have taken over then this context is current
		if (this.derivatives.isClear()) {
			return this;
		}

		// otherwise defer to the most recent derived
		return this.derivatives.last().getActive();
	}

	interrupt (besidesThisOne) {
		if (this != besidesThisOne) {
			this.eventDispatch.dispatch(eventInterruptContext, this);
		}
		this.derivatives.update((child) => {
			child.interrupt(besidesThisOne);
		});
	}

	onDispose (tagOrDOThis, doThis) {
		if (doThis == null) {
			this.eventDispatch.addListener(tagOrDOThis, eventDisposeContext, tagOrDOThis);
		} else {
			this.eventDispatch.addListener(tagOrDOThis, eventDisposeContext, doThis);
		}
	}

	dispose () {
		// first dispose all children
		if (this.derivatives != null) {
			this.derivatives.update((child) => {
				child.dispose();
			});
			this.derivatives = null;
		}

		// then clean up self
		if (this.parent != null) {
			this.eventDispatch.dispatch(eventInterruptContext, this);
			this.eventDispatch.dispatch(eventDisposeContext, this);

			this.parent.derivatives.remove(this);
			this.parent = null;
		}

		if (this.frameDispatch) {
			this.frameDispatch.dispose();
			this.frameDispatch = null;
		}
		if (this.eventDispatch) {
			this.eventDispatch.dispose();
			this.eventDispatch = null;
		}
	}
}

export const eventInterruptContext = 'event_interrupt_context';
export const eventDisposeContext = 'event_dispose_context';

export { UpdateList, FrameDispatch, EventDispatch, EventHandler, Context };
