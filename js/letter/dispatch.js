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

export { update_list, frame_dispatch };