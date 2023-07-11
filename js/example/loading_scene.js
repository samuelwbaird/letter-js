// example loading scene, displays a terrible animation using plain geometry
// polls loading of assets before displaying a title scene
// copyright 2020 Samuel Baird MIT Licence

import { geometry, tween, resource, AppNode } from '../letter/letter.js';
import TitleScene from './title_scene.js';

class LoadingScene extends AppNode {

	constructor () {
		super();
	}

	begin () {
		this.view.addRect(100, 50, geometry.Color.black, { x : 100, y : 100 });
		// bad loading indicator tween
		const t1 = this.view.addRect(80, 40, new geometry.Color(0, 1, 1, 1), { x: 100, y : 100, rotation : 0.5 });
		this.tween(t1, tween.Easing.linear(120), { rotation : 10 });

		const font = new geometry.Font(this.screen.ctx, 50, 'sans-serif');
		this.view.addLabel(font, 'Beautiful Loading Scene', new geometry.Color(0, 0, 0, 1), { x : 0, y : 30 });
	}

	update () {
		super.update(this);
		if (resource.requireAssets('example_assets/', ['map_x1', 'test_x1'])) {
			this.app.setScene(new TitleScene());
		}
	}
}

export default LoadingScene;
