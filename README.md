# letter-js

A partial port of letter, to plain old JS, now in shiny ES6

This was an experiment in providing something similar to the display list code built in letter, running on Love2D, for plain old JS and canvas instead.

Originally developed with a custom loader, and custom class and module system, now all migrated to default ES6 mechanisms. Strict eslint settings are provided to force use of let, const, arrow functions, es6 classes throughout.

Resources are loaded using methods without callbacks, keep calling the method as part of the frame timer until it returns true to indicate the resources are ready.

##structure

The app module controls overall event dispatch and frame timing.

Scenes should be objects derived from app.node, and an example loading screen is provided, along with a title screen that displays onces the required resources have loaded.

The Lua letter library should serve as a reference on the display list, event handling, tweening, resource loading and animation, although not all features port naturally to JS.

##TODO

 * Add support for rect, circle, label within animation clip data (eg. clip_frame.add_label_content)
 * During animation reuse of frames, check that types match as well as instance name