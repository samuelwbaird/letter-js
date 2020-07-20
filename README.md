# letter-js

A partial port of letter, to plain old JS

This was an experiment in providing something similar to the display list code built in letter, running on Love2D, for plain old JS and canvas instead. Not all concepts translate nicely, and performance is poor.

There is also a different approach to loading and requiring code. Resources are loaded using methods without callbacks, keep calling the method as part of the frame timer until it returns true to indicate the resources are ready. As part of building only on plain JS there is a basic module loader in the style of require JS and some very thin class and module structures.

##structure

_letter.js_ bootstraps the structure over plain JS.

There should be one _app_ object running the overall event dispatch and frame timing.

Scenes should be objects derived from _app___node_, and an example loading screen is provided, along with a title screen that displays onces the required resources have loaded.

The Lua letter library should serve as a reference on the display list, event handling, tweening, resource loading and animation, although not all features port naturally to JS.

##TODO

 * Add support for rect, circle, label within animation clip data (eg. clip_frame.add_label_content)
 * During animation reuse of frames, check that types match as well as instance name