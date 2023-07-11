// aggregate letter module, use app.launch to initiate the app object and first scene
// copyright 2020 Samuel Baird MIT Licence

import * as geometry from './geometry.js';
import * as dispatch from './dispatch.js';
import * as coroutine from './coroutine.js';
import * as state from './state.js';
import * as resource from './resource.js';
import * as display from './display.js';
import * as ui from './ui.js';
import * as tween from './tween.js';

// appNode, standard heavy weight object used to create a back bone heirachy of objects at runtime
// the app module also acts as a single instance of managing current scene, timer, events and screen fit
// the app is made of a tree of appNodes, each heavy weight objects
// that delimit the lifetime and update cycle of their child objects

class AppNode {

	constructor () {
		this.view = new display.DisplayList();

		this.tweenManager = null;
		this.frameDispatch = null;

		this.children = null;
		this.disposables = null;
	}

	addDisposable (disposable) {
		if (!this.disposables) {
			this.disposables = [];
		}
		this.disposables.push(disposable);
		return disposable;
	}

	// override
	prepare () {}
	begin () {}

	add (child, viewParent) {
		if (!this.children) {
			this.children = new dispatch.UpdateList();
		}
		this.children.add(child);

		child.app = this.app;
		child.screen = this.screen;
		child.context = this.context;

		// viewParent = false to not add, or this appNodes view by default
		if (child.view != null) {
			child.prepare();

			if (viewParent == undefined) {
				viewParent = this.view;
			}
			if (viewParent) {
				viewParent.add(child.view);
			}

			// begin is called only once the view is added
			child.begin();
		}

		return child;
	}

	remove (child) {
		if (!this.children) {
			return;
		}
		if (this.children.remove(child)) {
			child.dispose();
		}
	}

	removeAllChildren () {
		if (this.children) {
			const oldList = this.children;
			this.children = null;
			for (const updateListEntry of oldList.list) {
				updateListEntry.obj.dispose();
			}
		}
	}

	getTweenManager () {
		if (!this.tweenManager) {
			this.tweenManager = new tween.Manager();
		}
		return this.tweenManager;
	}

	tween (target, easing, properties, optionalParams) {
		const t = new tween.Tween(target, easing, properties, optionalParams);
		this.getTweenManager().add(t);
		return t;
	}

	getFrameDispatch () {
		if (!this.frameDispatch) {
			this.frameDispatch = new dispatch.FrameDispatch();
		}
		return this.frameDispatch;
	}

	getCoroutineManager () {
		if (!this.coroutineManager) {
			this.coroutineManager = new coroutine.CoroutineManager(this);
		}
		return this.coroutineManager;
	}

	delay (count, fn, tag) {
		this.getFrameDispatch().delay(count, fn, tag);
	}

	addButton (clip, action, initValues, context) {
		const btn = new ui.Button(clip, action, initValues, (context != null) ? context : this.context);
		this.addDisposable(btn);
		return btn;
	}

	addTouchArea (displayObject, padding, context) {
		const ta = ui.TouchArea.bounds(displayObject, padding, (context != null) ? context : this.context);
		this.addDisposable(ta);
		return ta;
	}

	addTouchAreaRect (displayObject, x, y, width, height, context) {
		const ta = ui.TouchArea.rect(displayObject, new geometry.Rect(x, y, width, height), (context != null) ? context : this.context);
		this.addDisposable(ta);
		return ta;
	}

	createModalContext () {
		const modalContext = this.context.derive();
		this.addDisposable(modalContext);
		return modalContext;
	}

	update () {
		if (this.tweenManager) {
			this.tweenManager.update();
		}
		if (this.coroutineManager) {
			this.coroutineManager.update();
		}
		if (this.frameDispatch) {
			this.frameDispatch.update();
		}
		if (this.children) {
			this.children.update((child) => {
				child.update();
			});
		}
	}

	dispose () {
		if (this.view) {
			this.view.removeFromParent();
		}

		if (this.children) {
			this.children.update((child) => {
				child.dispose();
			});
			this.children = null;
		}

		if (this.tweenManager) {
			this.tweenManager.dispose();
			this.tweenManager = null;
		}

		if (this.coroutineManager) {
			this.coroutineManager.dispose();
			this.coroutineManager = null;
		}

		if (this.frameDispatch) {
			this.frameDispatch.dispose();
			this.frameDispatch = null;
		}

		if (this.disposables) {
			for (const disposable of this.disposables) {
				if (typeof disposable == 'function') {
					disposable();
				} else if (disposable.dispose) {
					disposable.dispose();
				} else {
					throw 'cannot dispose ' + disposable;
				}
			}
			this.disposables = null;
		}
	}
}

// there should generally be one app object at the root of the appNode tree
// tying it in with the rest of the browser environment

class App {

	constructor (screen) {
		this.renderCallback = new ui.RenderCallback();
		this.fps = new ui.FixedRateTimer(60);
		this.animationFps = new ui.FixedRateTimer(60);
		this.frameDispatch = new dispatch.FrameDispatch();

		this.screen = screen;
		this.currentScene = null;

		this.context = new dispatch.Context();

		if (this.screen) {
			this.screen.setContext(this.context);
		}
	}

	update () {
		// keep up to date with window size
		if (this.screen != null) {
			this.screen.update();
		}

		// animation frames
		let requiresRender = false;
		const animationFrames = this.animationFps.getFramesDue();
		if (animationFrames > 0 && this.screen != null) {
			requiresRender = true;
			for (let i = 0; i < animationFrames; i++) {
				// update animation heirachy and fire off on-complete events once done
				const onCompletes = [];
				this.screen.rootView.updateAnimatedClips(this.animationFps.delta, (callback) => {
					onCompletes.push(callback);
				});
				for (const callback of onCompletes) {
					callback();
				}
			}
		}

		// top level frame dispatch outside of all scenes and context
		this.frameDispatch.update();

		// top level ui context dispatch include deferred events
		this.context.getActive().update();

		// logical update frames
		const updateFrames = this.fps.getFramesDue();
		if (updateFrames > 0 && this.currentScene != null) {
			requiresRender = true;
			for (let f = 0; f < updateFrames; f++) {
				if (this.currentScene != null) {
					this.currentScene.update();
				}
			}
		}

		// if any of the above means we need to re-render the canvas then do it here
		if (requiresRender && this.screen != null) {
			this.screen.render();
		}
	}

	setFrameRate (newFps, newAnimationFps, minFrames, maxFrames, reset) {
		if (!newAnimationFps) {
			newAnimationFps = newFps;
		}
		this.fps.setFps(newFps, minFrames, maxFrames, reset);
		this.animationFps.setFps(newAnimationFps, minFrames, maxFrames, reset);
	}

	pause () {
		this.renderCallback.stop();
	}

	resume () {
		this.renderCallback.start(() => {
			this.update();
		});
	}

	setScene (scene) {
		if (this.currentScene != null) {
			this.currentScene.dispose();
			this.currentScene = null;
		}

		this.context.reset();

		if (scene) {
			this.currentScene = scene;
			this.currentScene.app = this;
			this.currentScene.screen = this.screen;
			this.currentScene.context = this.context;

			this.currentScene.prepare();
			if (this.screen != null) {
				this.screen.rootView.add(scene.view);
			}
			this.currentScene.begin();
		}

		this.fps.reset();
		this.animationFps.reset();
	}

}

function launchApp (canvas, width, height, fit) {
	// create a screen object to map to the canvase if there is one
	const screen = (canvas != null) ? new ui.CanvasScreen(canvas, width, height, fit) : null;

	// create an launch the app with an empty scene
	const appInstance = new App(screen);
	appInstance.setScene(new AppNode());
	appInstance.resume();
	return appInstance;
}

export { geometry, dispatch, coroutine, state, resource, display, ui, tween, AppNode, launchApp };
