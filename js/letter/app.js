'use strict';
// an app object, a single instance of which is created at launch, managing timer, events and screen fit
// copyright 2016 Samuel Baird MIT Licence

define(['letter.geometry', 'letter.dispatch', 'letter.display_list', 'letter.event_dispatch', 'letter.resources', 'letter.button'], function (geometry, dispatch, display_list, event_dispatch, resources, button) {


	var fixed_rate_timer = klass(function (fixed_rate_timer) {
		fixed_rate_timer.init = function (fps, min_frames, max_frames, reset_frames) {
			this.set_fps(fps, min_frames, max_frames, reset_frames)
		}
		
		fixed_rate_timer.set_fps = function (fps, min_frames = 1, max_frames = 4, reset_frames = 16) {
			this.fps = fps;
			this.min_frames = min_frames;
			this.max_frames = max_frames;
			this.reset_frames = reset_frames;
			this.reset();
		}
		
		fixed_rate_timer.reset = function () {
			this.last_time = Date.now();
			this.time_accumulated = 0;
		}
		
		fixed_rate_timer.get_frames_due = function () {
			var now = Date.now();
			var delta = (now - this.last_time) / 1000.0;
			this.time_accumulated += delta;
			this.last_time = now;
			
			var frames_due = Math.floor(this.time_accumulated * this.fps)
			
			if (this.reset_frames > 0 && frames_due > this.reset_frames) {
				this.time_accumulated = 0;
				frames_due = 1;
			} else if (this.max_frames > 0 && frames_due > this.max_frames) {
				this.time_accumulated = 0;
				frames_due = this.max_frames;				
			} else if (this.min_frames > 0 && frames_due < this.min_frames) {
				frames_due = 0;
			} else {
				this.time_accumulated -= frames_due / this.fps;
			}
			
			return frames_due;
		}
		
	});

	var app = klass(function (app) {
		
		app.init = function (screen, timer) {
			this.screen = screen;
			this.timer = timer;
			this.fps = new fixed_rate_timer(60);
			this.animation_fps = new fixed_rate_timer(60);
			this.resources = resources;

			this.dispatch = new dispatch.frame_dispatch();
			this.current_scene = null;
			
			var self = this;
			button.configure(function (action) { self.dispatch.delay(1, action); });
		}
		
		app.set_scene = function (scene) {
			if (this.current_scene != null) {
				this.current_scene.dispose();
				this.current_scene = null;
			}
			
			this.dispatch.clear();
			event_dispatch.reset_shared_instance();
			
			// if a string reference then load before continuing
			if (typeof scene == 'string') {
				var self = this;
				require([scene], function (loaded_scene_class) {
					self.set_scene(new loaded_scene_class());
				});
				return;
			}
			
			if (scene) {
				this.last_time = null;
				this.current_scene = scene
				this.current_scene.app = this
				this.current_scene.resources = resources
				this.current_scene.screen = this.screen
				
				this.current_scene.prepare();
				if (this.screen != null) {
					this.screen.root_view.add(scene.view);
				}
				this.current_scene.begin();
			}
			
			this.fps.reset();
			this.animation_fps.reset();
		}
		
		app.update = function () {
			// keep up to date with window size
			if (this.screen != null) {
				this.screen.update();
			}
			
			var requires_render = false;
			var animation_frames = this.animation_fps.get_frames_due();
			if (animation_frames > 0 && this.screen != null) {
				requires_render = true;
				for (var i = 0; i < animation_frames; i++) {
					// update animation heirachy and fire off on-complete events once done
					var on_completes = [];
					this.screen.root_view.update_animated_clips(1.0 / this.fps, function (callback) { on_completes.push(callback); });
					on_completes.with_each(function (callback) {
						callback();
					});
				}
			}
			
			event_dispatch.shared_instance().dispatch_deferred();
			if (global.safe_updates) {
				this.dispatch.safe_update();
			} else {
				this.dispatch.update();
			}
			
			var update_frames = this.fps.get_frames_due();
			if (update_frames > 0 && this.current_scene != null) {
				requires_render = true;
				for (var f = 0; f < update_frames; f++) {
					if (this.current_scene != null) {
						this.current_scene.update();
					}
				}
			}

			if (requires_render && this.screen != null) {
				this.screen.render();
			}
		}
		
		app.set_frame_rate = function (fps, animation_fps, min_frames, max_frames, reset) {
			if (!animation_fps) {
				animation_fps = fps;
			}			
			this.fps = new fixed_rate_timer(fps, min_frames, max_frames, reset);
			this.animation_fps = new fixed_rate_timer(animation_fps, min_frames, max_frames, reset);
		}
		
		app.pause = function () { this.timer.stop(); }
		app.resume = function () { var self = this; this.timer.start(function () { self.update(); }); }
	});
	
	var screen = klass(function (screen) {
		screen.init = function (canvas, ideal_width, ideal_height, fit) {
			this.canvas = canvas;
			this.ctx = canvas.getContext("2d");
			this.ideal_height = ideal_height;
			this.ideal_width = ideal_width;
			this.fit = fit;
			this.root_view = new display_list.display_list();
			
			this.update();
			
			var self = this;
			canvas.addEventListener("mousedown", function (evt) { self.touch_event('touch_begin', evt); }, false);
			canvas.addEventListener("mousemove", function (evt) { self.touch_event('touch_move', evt); }, false);
			canvas.addEventListener("mouseup", function (evt) { self.touch_event('touch_end', evt); }, false);

			canvas.addEventListener("touchstart", function (evt) { self.touch_event('touch_begin', evt); }, false);
			canvas.addEventListener("touchmove", function (evt) { self.touch_event('touch_move', evt); }, false);
			canvas.addEventListener("touchend", function (evt) { self.touch_event('touch_end', evt); }, false);
			canvas.addEventListener("touchcancel", function (evt) { self.touch_event('touch_cancel', evt); }, false);
		};
	
		screen.touch_event = function (event_name, evt) {
			evt.preventDefault();
			
			// correct co-ords for hdpi displays
			var scale_x = canvas.width / canvas.clientWidth;
			var scale_y = canvas.height / canvas.clientHeight;
			
			if (evt.changedTouches) {
				for (var i = 0; i < evt.changedTouches.length; i++) {
					var touch = evt.changedTouches[i];
					event_dispatch.shared_instance().defer(event_name, { id : touch.identifier, time : Date.now, x : (touch.pageX - canvas.offsetLeft) * scale_x, y : (touch.pageY - canvas.offsetTop) * scale_y });
				}
			} else {
				event_dispatch.shared_instance().defer(event_name, { id : 1, time : Date.now, x : (evt.pageX - canvas.offsetLeft) * scale_x, y : (evt.pageY - canvas.offsetTop) * scale_y });
			}
		};
		
		screen.update = function () {
			// update transform of root view to match sizing

			// update scaling to fit nominal sizing to canvas size
			var scale_x = this.canvas.width / this.ideal_width;
			var scale_y = this.canvas.height / this.ideal_height;
			var scale = 1;
			
			if (this.fit == 'fit') {
				scale = (scale_x < scale_y) ? scale_x : scale_y;
			} else {
				// other screenfit strategies
			}
			
			this.width = this.canvas.width / scale;
			this.height = this.canvas.height / scale;
			
			this.root_view.scale_x = scale;
			this.root_view.scale_y = scale;
		}
		
		screen.render = function () {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.root_view.render(this.ctx, geometry.default_transform()); 
		}
		
	});

	var timer = klass(function (timer) {
		// cross browser request animation frame
		var requestAnimFrame = (function() {
		    return window.requestAnimationFrame       ||
		        window.webkitRequestAnimationFrame ||
		        window.mozRequestAnimationFrame    ||
		        window.oRequestAnimationFrame      ||
		        window.msRequestAnimationFrame     ||
		        function(callback) {
		            window.setTimeout(callback, 1000 / 60);
		        };
		}) ();
	
		var get_time = function () { return Date.now(); }
	
		timer.init = function () {
			this.active = false;
		}
		
		timer.start = function (callback) {
			this.active = true;
		
			var self = this;
			var next_frame = function () {
				if (!self.active) {
					return;
				}
				requestAnimFrame(next_frame);
				callback();
			}

			requestAnimFrame(next_frame);
		}
		
		timer.stop = function () {
			this.active = false;
		}
	});

	// exported module
	return {
	
		launch : function (canvas, scene, width, height, fit) {
			console.log('app launch');
			var _screen = (canvas != null) ? new screen(canvas, width, height, fit) : null;

			var _timer = new timer();
			var _app = new app(_screen, _timer);

			window.app = _app;
			window.resources = resources;
			
			_app.set_scene(scene);
			_app.resume();
			return _app;
		}
	
	}
})