// a basic coroutine system
// copyright 2020 Samuel Baird MIT Licence

import * as dispatch from './dispatch.js';

const yield_cancel = {};

class coroutine {
	constructor (generator, apply_this) {
		if (apply_this) {
			this.generator = generator.apply(apply_this);
		} else {
			this.generator = generator();
		}

		this.yield = null;
		this.complete = false;
	}

	update () {
		if (this.complete) {
			return true;
		}

		// do we have a current yield condition
		if (this.yield) {
			const satisfied = this.yield();
			if (satisfied) {
				this.yield = null;
			}
		}

		if (!this.yield) {
			const result = this.generator.next();
			this.yield = result.value;
			if (result.done || this.yield == yield_cancel) {
				this.complete = true;
				return true;
			}
		}
	}
}

class coroutine_manager {
	constructor (apply_this) {
		this.apply_this = apply_this;
		this.update_list = new dispatch.update_list();
	}

	run (generator, apply_this) {
		this.update_list.add(new coroutine(generator, (apply_this != null) ? apply_this : this.apply_this));
	}

	update () {
		this.update_list.safe_update((c) => {
			return c.update();
		}, true);
	}

	safe_update () {
		this.update_list.safe_update((c) => {
			return c.update();
		}, true);
	}

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

function yield_frame () {
	return function () {
		return true;
	};
}

function yield_frames (frames) {
	let f = frames;
	return function () {
		f--;
		return f <= 0;
	};
}

function yield_tween (tween) {
	return function () {
		return tween.frame >= tween.easing.length;
	};
}

function yield_condition (condition) {
	return condition;
}

function yield_coroutine (generator, apply_this) {
	const co = coroutine(generator, apply_this);
	return function () {
		return co.update();
	};
}

export { coroutine_manager, coroutine, yield_cancel, yield_frame, yield_frames, yield_tween, yield_condition, yield_coroutine };