// a title screen exercising tweens, asset freezing, text line breaks
// and 2 frame animation used to create a button
// copyright 2020 Samuel Baird MIT Licence

import { geometry, resource, tween, app_node } from '../letter/letter.js';

class title_scene extends app_node {
	prepare () {
		resource.require_asset('example_assets/', 'map_x1');
		resource.require_asset('example_assets/', 'test_x1');
	}

	begin () {
		this.view.add_rect(300, 460, geometry.color.black, {
			x: 10,
			y: 10,
		});

		const map = this.view.add_image('map_background', { x : 160, y : 240, scale_x : 1 });
		map.add_circle(30, new geometry.color(0.5, 1, 0.5, 1), { y : 100 });
		map.add_image('map_marker', { x : 0, y : 100 });

		const font = new geometry.font(this.screen.ctx, 36, 'sans-serif', 'center');
		map.add_label(font, 'Testing Text', new geometry.color(0.5, 0.1, 0.5, 1), { x : 0, y : -50 }).freeze();

		this.tween(map, tween.easing.linear(60 * 20), { rotation : 20, scale_x : 0.5, scale_y : 0.5 });

		const small_font = new geometry.font(this.screen.ctx, 18, 'serif', 'center');
		console.log(small_font.breaklines('Testing a lot of text to check for breaklines. I hope this works ok', 500));
		console.log(small_font.breaklines('Testing a lot of text to check for breaklines. I hope this works ok', 400));
		console.log(small_font.breaklines('Testing a lot of text to check for breaklines. I hope this works ok', 300));
		this.view.add_label(small_font, 'Testing a lot of text to check for breaklines. I hope this works ok', geometry.color.white, {
			word_wrap : 200,
			x : 160,
			y : 320,
		});

		const play = this.view.add_clip('button',  { x : 160, y : 240 });
		this.add_button(play, () => {
			console.log('did play');
			if (map.is_frozen) {
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

export default title_scene;