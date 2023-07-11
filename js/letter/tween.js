// a basic tween system, assumes fixed framerate and tween easing is defined as a sequence
// of numbers from 0 to 1 over that number of frames
// copyright 2020 Samuel Baird MIT Licence

import * as dispatch from './dispatch.js';

class Easing {

	static fromFormula (frames, formula) {
		const out = [];
		const scale = 1 / frames;
		for (let i = 1; i <= frames; i++) {
			const ratio = i * scale;
			out.push(formula(ratio));
		}
		return out;
	}

	static linear (frames) {
		return Easing.fromFormula(frames, (ratio) => {
			return ratio;
		});
	}

	static easeIn (frames) {
		return Easing.fromFormula(frames, (ratio) => {
			return ratio * ratio;
		});
	}

	static easeOut (frames) {
		return Easing.fromFormula(frames, (ratio) => {
			return 1 - (1 - ratio) * (1 - ratio);
		});
	}

	static easeInout (frames) {
		return Easing.fromFormula(frames, (ratio) => {
			ratio = ratio * 2;
			if (ratio < 1) {
				return ratio * ratio * 0.5;
			} else {
				ratio = 1 - (ratio - 1);
				return 0.5 + (1 - (ratio * ratio)) * 0.5;
			}
		});
	}

	static interpolate (values, frames) {
		const scale = (values.length - 1) / frames;
		const out = [];
		for (let i = 0; i < frames; i++) {
			const ratio = (i + 1) * scale;
			const base = Math.floor(ratio);
			const offset = ratio - base;
			if (base < values.length) {
				out[i] = (values[base] * (1 - offset)) + (values[base + 1] * offset);
			} else {
				out[i] = values[values.length - 1];
			}
		}
		// make sure the final value always is an exact match
		out[out.length - 1] = values[values.length - 1];
		return out;
	}

}

class Tween {
	constructor (target, easing, properties, optionalParams) {
		this.target = target;
		this.easing = easing;
		// backwards compatibility, if optionalParams is a function, it is the onComplete
		if (typeof optionalParams == 'function') {
			this.onComplete = optionalParams;
		} else if (optionalParams) {
			this.onComplete = optionalParams.onComplete;
			this.delay = optionalParams.delay;
		}

		// gather start and end values for all tweened properties
		this.properties = {};
		for (const k in properties) {
			this.properties[k] = { initial : target[k], final : properties[k] };
		}

		this.frame = 0;
	}

	update () {
		if (this.delay && this.delay > 0) {
			this.delay--;
			if (this.delay == 0) {
				// re-capture starting values after the delay if one applies
				for (const k in this.properties) {
					this.properties[k].initial = this.target[k];
				}
			}
			return false;
		}

		if (this.frame < this.easing.length) {
			const ratio = this.easing[this.frame++];
			const inverse = 1 - ratio;

			for (const k in this.properties) {
				const prop = this.properties[k];
				this.target[k] = (prop.initial * inverse) + (prop.final * ratio);
			}

			// return true if complete
			if (this.frame == this.easing.length) {
				const onComplete = this.onComplete;
				this.onComplete = null;
				if (onComplete) {
					onComplete();
				}
			}
		}

		return this.frame >= this.easing.length;
	}

	complete () {
		const ratio = this.easing[this.easing.length - 1];
		const inverse = 1 - ratio;

		for (const k in this.properties) {
			const prop = this.properties[k];
			this.target[k] = (prop.initial * inverse) + (prop.final * ratio);
		}

		this.frame = this.easing.length;
		const onComplete = this.onComplete;
		this.onComplete = null;
		if (onComplete) {
			onComplete();
		}
		return true;
	}
}

class Manager {

	constructor () {
		this.tweens = new dispatch.UpdateList();
	}

	add (tween) {
		this.tweens.add(tween, tween.target);
	}

	removeTweensOf (target) {
		this.tweens.remove(target);
	}

	update () {
		this.tweens.update((tween) => {
			tween.update();
		});
	}

	completeAll () {
		this.tweens.update((tween) => {
			tween.complete();
		});
	}

	clear () {
		this.tweens.clear();
	}

	dispose () {
		this.tweens.clear();
		this.tweens = null;
	}

}

export { Easing, Tween, Manager };
