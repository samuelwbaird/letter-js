// a basic coroutine system
// copyright 2020 Samuel Baird MIT Licence

import * as dispatch from './dispatch.js';

const yieldCancel = {};

class Coroutine {
	constructor (generator, applyThis) {
		if (applyThis) {
			this.generator = generator.apply(applyThis);
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
			if (result.done || this.yield == yieldCancel) {
				this.complete = true;
				return true;
			}
		}
	}
}

class CoroutineManager {
	constructor (applyThis) {
		this.applyThis = applyThis;
		this.updateList = new dispatch.UpdateList();
	}

	run (generator, applyThis) {
		this.updateList.add(new Coroutine(generator, (applyThis != null) ? applyThis : this.applyThis));
	}

	update () {
		// this.updateList.cloneUpdate((c) => {
		this.updateList.update((c) => {
			return c.update();
		}, true);
	}

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

function yieldFrame () {
	return function () {
		return true;
	};
}

function yieldFrames (frames) {
	let f = frames;
	return function () {
		f--;
		return f <= 0;
	};
}

function yieldTween (tween) {
	return function () {
		return tween.frame >= tween.easing.length;
	};
}

function yieldCondition (condition) {
	return condition;
}

function yieldCoroutine (generator, applyThis) {
	const co = coroutine(generator, applyThis);
	return function () {
		return co.update();
	};
}

export { CoroutineManager, Coroutine, yieldCancel, yieldFrame, yieldFrames, yieldTween, yieldCondition, yieldCoroutine };
