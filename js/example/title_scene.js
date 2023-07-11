// a title screen exercising tweens, asset freezing, text line breaks
// and 2 frame animation used to create a button
// copyright 2020 Samuel Baird MIT Licence

import { geometry, resource, tween, AppNode } from '../letter/letter.js';

class TitleScene extends AppNode {
	prepare () {
		resource.requireAsset('example_assets/', 'map_x1');
		resource.requireAsset('example_assets/', 'test_x1');
	}

	begin () {
		this.view.addRect(300, 460, geometry.Color.black, {
			x: 10,
			y: 10,
		});

		const map = this.view.addImage('map_background', { x : 160, y : 240, scaleX : 1 });
		map.addCircle(30, new geometry.Color(0.5, 1, 0.5, 1), { y : 100 });
		map.addImage('map_marker', { x : 0, y : 100 });

		const font = new geometry.Font(this.screen.ctx, 36, 'sans-serif', 'center');
		map.addLabel(font, 'Testing Text', new geometry.Color(0.5, 0.1, 0.5, 1), { x : 0, y : -50 }).freeze();

		this.tween(map, tween.Easing.linear(60 * 20), { rotation : 20, scaleX : 0.5, scaleY : 0.5 });

		const smallFont = new geometry.Font(this.screen.ctx, 18, 'serif', 'center');
		console.log(smallFont.breaklines('Testing a lot of text to check for breaklines. I hope this works ok', 500));
		console.log(smallFont.breaklines('Testing a lot of text to check for breaklines. I hope this works ok', 400));
		console.log(smallFont.breaklines('Testing a lot of text to check for breaklines. I hope this works ok', 300));
		this.view.addLabel(smallFont, 'Testing a lot of text to check for breaklines. I hope this works ok', geometry.Color.white, {
			wordWrap : 200,
			x : 160,
			y : 320,
		});

		const play = this.view.addClip('button',  { x : 160, y : 240 });
		this.addButton(play, () => {
			console.log('did play');
			if (map.isFrozen) {
				map.unfreeze();
			} else {
				map.freeze(null, 0.1);
			}
		});
	}

	update () {
		super.update();

		// horizontally center the 320 width content
		this.view.x = (this.screen.width * 0.5) - 160;
	}
}

export default TitleScene;
