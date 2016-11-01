'use strict';
// an app object, a single instance of which is created at launch, managing timer, events and screen fit
// copyright 2016 Samuel Baird MIT Licence

define(['letter.geometry', 'letter.dispatch', 'letter.display_list', 'letter.event_dispatch', 'letter.resources', 'letter.button'], function (geometry, dispatch, display_list, event_dispatch, resources, button) {

	var app = klass(function (app) {
		
		app.init = function (screen, timer) {
			this.screen = screen;
			this.timer = timer;
			this.fps = timer.fps;
			this.resources = resources;

			this.dispatch = new dispatch.frame_dispatch();
			this.current_scene = null;
			this.last_time = null;
			
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
				this.screen.root_view.add(scene.view);
				this.current_scene.begin();
			}
		}
		
		app.update = function () {
			var now = Date.now();	
			this.screen.update();
			
			// update animation heirachy and fire off on-complete events once done
			var on_completes = [];
			this.screen.root_view.update_animated_clips(1.0 / this.fps, function (callback) { on_completes.push(callback); });
			on_completes.with_each(function (callback) {
				callback();
			});
			
			event_dispatch.shared_instance().dispatch_deferred();
			if (global.safe_updates) {
				this.dispatch.safe_update();
			} else {
				this.dispatch.update();
			}
			
			if (this.current_scene != null) {
				var frames = 1;
				if (this.last_time != null) {
					var delta = (now - this.last_time);
					if (delta > (1000.0 / this.fps) * 1.25) {
						frames = 2;
					}
				}
				for (var f = 0; f < frames; f++) {
					if (this.current_scene != null) {
						this.current_scene.update();
					}
				}
				this.screen.render();
			}
			this.last_time = now;
		}
		
		app.set_frame_rate = function (fps) {
			this.timer.set_frame_rate(fps);
			this.fps = fps;
		}
		
		app.pause = function () { this.timer.stop(); }
		app.resume = function () { var self = this; this.timer.start(function () { self.update(); }); }
	});
	
	var screen = klass(function (screen) {
		screen.init = function (canvas, nominal_width, nominal_height, fit) {
			this.canvas = canvas;
			this.ctx = canvas.getContext("2d");
			this.nominal_height = nominal_height;
			this.nominal_width = nominal_width;
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
			if (evt.changedTouches) {
				for (var i = 0; i < evt.changedTouches.length; i++) {
					var touch = evt.changedTouches[i];
					event_dispatch.shared_instance().defer(event_name, { id : touch.identifier, time : Date.now, x : touch.pageX - canvas.offsetLeft, y : touch.pageY - canvas.offsetTop });
				}
			} else {
				event_dispatch.shared_instance().defer(event_name, { id : 1, time : Date.now, x : evt.pageX - canvas.offsetLeft, y : evt.pageY - canvas.offsetTop });
			}
		};
		
		screen.update = function () {
			// update transform of root view to match sizing
		}
		
		screen.render = function () {
			// update scaling to fit nominal sizing to canvas size
			var scale_x = this.canvas.width / this.nominal_width;
			var scale_y = this.canvas.height / this.nominal_height;
			var scale = 1;
			
			if (this.fit == 'fit') {
				scale = (scale_x < scale_y) ? scale_x : scale_y;
			} else {
				// other screenfit strategies
			}

			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.root_view.scale_x = scale;
			this.root_view.scale_y = scale;
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
			this.fps = 60;
			this.minimum_delay = (1000.0 / this.fps) - 3;
			this.last_frame = 0;
		}
		
		timer.start = function (callback) {
			this.active = true;
		
			var self = this;
			var next_frame = function () {
				if (!self.active) {
					return;
				}
				requestAnimFrame(next_frame);
				var now = get_time();
				if (now - self.last_frame < self.minimum_delay) {
					// skip it
				} else {
					self.last_frame = now;
					callback();
				}
			}

			requestAnimFrame(next_frame);
		}
		
		timer.stop = function () {
			this.active = false;
		}
		
		timer.set_frame_rate = function (fps) {
			this.fps = fps;
			this.minimum_delay = (1000.0 / fps) - 3;
		}
	});

	// exported module
	return {
	
		launch : function (canvas, scene, width, height, fit) {
			console.log('app launch');
			var _screen = new screen(canvas, width, height, fit);
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