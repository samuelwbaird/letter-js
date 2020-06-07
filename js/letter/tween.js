'use strict';
var global = window

// a basic tween system, assumes fixed framerate and tween easing is defined as a sequence
// of numbers from 0 to 1 over that number of frames
// copyright 2016 Samuel Baird MIT Licence

define([], function () {
	var easing = modul(function (easing) {
		var from_formula = function (frames, formula) {
			var out = [];
			var scale = 1 / frames;
			for (var i = 1; i <= frames; i++) {
				var ratio = i * scale;
				out.push(formula(ratio));
			}
			return out;
		}
		
		easing.linear = function (frames) {
			return from_formula(frames, function (ratio) {
				return ratio;
			})
		}
		
		easing.ease_in = function (frames) {
			return from_formula(frames, function (ratio) {
				return ratio * ratio
			})
		}

		easing.ease_out = function (frames) {
			return from_formula(frames, function (ratio) {
				return 1 - (1 - ratio) * (1 - ratio)
			})
		}

		easing.ease_inout = function (frames) {
			return from_formula(frames, function (ratio) {
				ratio = ratio * 2
				if (ratio < 1) {
					return ratio * ratio * 0.5
				} else {
					ratio = 1 - (ratio - 1)
					return 0.5 + (1 - (ratio * ratio)) * 0.5
				}
			})
		}
		
		easing.interpolate = function (values, frames) {
			var scale = (values.length - 1) / frames;
			var out = [];
			for (var i = 1; i <= frames; i++) {
				var ratio = (i - 1) * scale;
				var base = Math.floor(ratio);
				var offset = ratio - base;
				if (base < values.length) {
					out[i] = (values[base] * (1 - offset)) + (values[base + 1] * offset)
				} else {
					out[i] = values[values.length - 1]
				}
			}
			return out
		}		
	});
	
	var tween = klass(function (tween) {
		tween.init = function (target, easing, properties, optional_params) {
			this.target = target
			this.easing = easing
			// backwards compatibility, if optional_params is a function, it is the on_complete
			if (typeof optional_params == 'function') {
				this.on_complete = optional_params
			} else if (optional_params) {
				this.on_complete = optional_params.on_complete
				this.delay = optional_params.delay				
			}
		
			// gather start and end values for all tweened properties
			this.properties = {}
			for (var k in properties) {
				this.properties[k] = { initial : target[k], final : properties[k] }
			}
		
			this.frame = 0
		}
	
		tween.update = function () {
			if (this.delay && this.delay > 0) {
				this.delay--;
				if (this.delay == 0) {
					// re-capture starting values after the delay if one applies
					for (var k in this.properties) {
						this.properties[k].initial = this.target[k];
					}
				}
				return false;
			}
			
			if (this.frame < this.easing.length) {
				var ratio = this.easing[this.frame++];
				var inverse = 1 - ratio;
		
				for (var k in this.properties) {
					var prop = this.properties[k];
					this.target[k] = (prop.initial * inverse) + (prop.final * ratio);
				}
		
				// return true if complete
				if (this.frame == this.easing.length) {
					var on_complete = this.on_complete
					this.on_complete = null
					if (on_complete) {
						on_complete()
					}
				}
			}

			return this.frame >= this.easing.length;
		}		
	});
	
	var manager = klass(function (manager) {
		manager.init = function () {
			this.tweens = new update_list();
		}
		
		manager.add = function (tween) {
			this.tweens.add(tween, tween.target);
		}
		
		manager.remove_tweens_of = function (target) {
			this.tweens.remove(target);
		}
		
		var update_func = function (tween) {
			return tween.update();
		}
		
		manager.update = function () {
			this.tweens.update(update_func);
		}
		
		manager.safe_update = function () {
			this.tweens.safe_update(update_func);
		}
		
		manager.clear = function () {
			this.tweens.clear();
		}
		
		manager.dispose = function () {
			this.tweens.clear();
			this.tweens = null;
		}
	});
	
	return {
		easing : easing,
		tween : tween,
		manager : manager
	}
})