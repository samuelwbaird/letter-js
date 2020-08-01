// a basic tween system, assumes fixed framerate and tween easing is defined as a sequence
// of numbers from 0 to 1 over that number of frames
// copyright 2020 Samuel Baird MIT Licence

import * as dispatch from './dispatch.js';

class easing {

	static from_formula (frames, formula) {
		const out = [];
		const scale = 1 / frames;
		for (let i = 1; i <= frames; i++) {
			const ratio = i * scale;
			out.push(formula(ratio));
		}
		return out;
	}

	static linear (frames) {
		return easing.from_formula(frames, (ratio) => {
			return ratio;
		});
	}


	static ease_in (frames) {
		return easing.from_formula(frames, (ratio) => {
			return ratio * ratio;
		});
	}

	static ease_out (frames) {
		return easing.from_formula(frames, (ratio) => {
			return 1 - (1 - ratio) * (1 - ratio);
		});
	}

	static ease_inout (frames) {
		return easing.from_formula(frames, (ratio) => {
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


class tween {
	constructor (target, easing, properties, optional_params) {
		this.target = target;
		this.easing = easing;
		// backwards compatibility, if optional_params is a function, it is the on_complete
		if (typeof optional_params == 'function') {
			this.on_complete = optional_params;
		} else if (optional_params) {
			this.on_complete = optional_params.on_complete;
			this.delay = optional_params.delay;
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
				const on_complete = this.on_complete;
				this.on_complete = null;
				if (on_complete) {
					on_complete();
				}
			}
		}

		return this.frame >= this.easing.length;
	}
}

class manager {

	constructor () {
		this.tweens = new dispatch.update_list();
	}

	add (tween) {
		this.tweens.add(tween, tween.target);
	}

	remove_tweens_of (target) {
		this.tweens.remove(target);
	}

	update () {
		this.tweens.update((tween) => {
			tween.update();
		});
	}

	safe_update () {
		this.tweens.safe_update((tween) => {
			tween.update();
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


export { easing, tween, manager };
export default tween;