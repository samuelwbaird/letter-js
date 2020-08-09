// example loading scene, displays a terrible animation using plain geometry
// polls loading of assets before displaying a title scene
// copyright 2020 Samuel Baird MIT Licence

import { geometry, tween, app_node } from '../letter/letter.js';
import title_scene from './title_scene.js';

class loading_scene extends app_node {

	constructor () {
		super();
	}

	begin () {
		this.view.add_rect(100, 50, geometry.color.black, { x : 100, y : 100 });
		// bad loading indicator tween
		const t1 = this.view.add_rect(80, 40, new geometry.color(0, 1, 1, 1), { x: 100, y : 100, rotation : 0.5 });
		this.tween(t1, tween.easing.linear(120), { rotation : 10 });

		const font = new geometry.font(this.screen.ctx, 50, 'sans-serif');
		this.view.add_label(font, 'Beautiful Loading Scene', new geometry.color(0, 0, 0, 1), { x : 0, y : 30 });
	}

	update () {
		super.update(this);
		if (window.app.resources.require_assets('example_assets/', ['map_x1', 'test_x1'])) {
			window.app.set_scene(new title_scene());
		}
	}
}

export default loading_scene;