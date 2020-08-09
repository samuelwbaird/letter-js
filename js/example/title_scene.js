// a title screen exercising tweens, asset freezing, text line breaks
// and 2 frame animation used to create a button
// copyright 2020 Samuel Baird MIT Licence

import { geometry, tween, app_node } from '../letter/letter.js';

class title_scene extends app_node {
	prepare () {
		window.app.resources.require_asset('example_assets/', 'map_x1');
		window.app.resources.require_asset('example_assets/', 'test_x1');
	}

	begin () {
		const map = this.view.add_image('map_background', { x : 300, y : 200, scale_x : 1 });
		map.add_image('map_marker', { x : 0, y : -20 });
		map.add_circle(30, new geometry.color(0.5, 1, 0.5, 1), { y : -100 });

		const font = new geometry.font(this.screen.ctx, 50, 'sans-serif');
		map.add_label(font, 'Testing Text', new geometry.color(0.5, 0.1, 0.5, 1), { x : -50, y : -50 }).freeze();

		console.log(font.breaklines('Testing a lot of text to check for breaklines. I hope this works ok', 500));
		console.log(font.breaklines('Testing a lot of text to check for breaklines. I hope this works ok', 400));
		console.log(font.breaklines('Testing a lot of text to check for breaklines. I hope this works ok', 300));

		map.freeze(null, 0.5);
		this.tween(map, tween.easing.linear(60 * 20), { rotation : 20, scale_x : 2, scale_y : 2 });


		const small_font = new geometry.font(this.screen.ctx, 20, 'serif');
		this.view.add_label(small_font, 'Testing a lot of text to check for breaklines. I hope this works ok', null, {
			word_wrap : 200,
			y : 100,
		});


		const play = this.view.add_clip('button',  { x : 300, y : 200 });
		this.add_button(play, () => {
			console.log('did play');
			if (map.is_frozen) {
				map.unfreeze();
			} else {
				map.freeze();
			}
		});

	}
}

export default title_scene;