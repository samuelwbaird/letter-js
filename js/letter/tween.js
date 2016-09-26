'use strict';
var global = window

// a basic tween system, assumes fixed framerate and tween easing is defined as a sequence
// of numbers from 0 to 1 over that number of frames
// copyright 2016 Samuel Baird MIT Licence

define([], function () {
	var easing = modul(function (easing) {
		var cached_from_formula = function (cache, frames, formula) {
			return cache.get_or_set(frames, function () {
				var out = [];
				var scale = 1 / frames;
				for (var i = 1; i <= frames; i++) {
					var ratio = i * scale;
					out.push(formula(ratio));
				}
				return out;
			})
		}
		
		var linear_cache = new cache(128);
		easing.linear = function (frames) {
			return cached_from_formula(linear_cache, frames, function (ratio) {
				return ratio;
			})
		}
		
		var ease_in_cache = new cache(128);
		easing.ease_in = function (frames) {
			return cached_from_formula(ease_in_cache, frames, function (ratio) {
				return ratio * ratio
			})
		}

		var ease_out_cache = new cache(128)
		easing.ease_out = function (frames) {
			return cached_from_formula(ease_out_cache, frames, function (ratio) {
				return 1 - (1 - ratio) * (1 - ratio)
			})
		}

		var ease_inout_cache = new cache(128)
		easing.ease_inout = function (frames) {
			return cached_from_formula(ease_inout_cache, frames, function (ratio) {
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
		tween.init = function (target, easing, properties, on_complete) {
			this.target = target
			this.easing = easing
			this.on_complete = on_complete
		
			// gather start and end values for all tweened properties
			this.properties = {}
			for (var k in properties) {
				this.properties[k] = { initial : target[k], final : properties[k] }
			}
		
			this.frame = 0
		}
	
		tween.update = function () {
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