'use strict';
// example loading scene, displays a terrible animation using plain geometry
// polls loading of assets before displaying a title scene
// copyright 2016 Samuel Baird MIT Licence

define(['letter.app_node', 'letter.geometry', 'letter.tween'], function (app_node, geometry, tween) {
	return derive(app_node, function (base, loading_scene) {
		
		loading_scene.begin = function () {
			this.view.add_rect(100, 50, geometry.color.black, { x : 100, y : 100 });
			// bad loading indicator tween
			var t1 = this.view.add_rect(80, 40, new geometry.color(0, 1, 1, 1), { x: 100, y : 100, rotation : 0.5 });
			this.tween(t1, tween.easing.linear(120), { rotation : 10 })
			
			var font = new geometry.font(this.screen.ctx, 50, 'sans-serif');
			this.view.add_label(font, "Beautiful Loading Scene", new geometry.color(0, 0, 0, 1), { x : 0, y : 30 });
		}
		
		var done_log = false;
		loading_scene.update = function () {
			base.update.apply(this);
			
			if (app.resources.require_assets('example_assets/', [ 'map_x1', 'test_x1' ])) {
				app.set_scene('example.title_scene')
			}
		}
		
	})
})
