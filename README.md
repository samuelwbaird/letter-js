# letter-js

A partial port of letter, to plain old JS, now in shiny ES6

This was an experiment in providing something similar to the display list code built in letter, running on Love2D, for plain old JS and canvas instead.

Originally developed with a custom loader, and custom class and module system, now all migrated to default ES6 mechanisms. Strict eslint settings are provided to force use of let, const, arrow functions, es6 classes throughout.

Resources are loaded using methods without callbacks, keep calling the method as part of the frame timer until it returns true to indicate the resources are ready.

##structure

There should be one _app_ object running the overall event dispatch and frame timing.

Scenes should be objects derived from _app___node_, and an example loading screen is provided, along with a title screen that displays onces the required resources have loaded.

The Lua letter library should serve as a reference on the display list, event handling, tweening, resource loading and animation, although not all features port naturally to JS.

##TODO

 * Continue ES6 migration, make every file a module, not a default class (touch area and button into ui.touch etc.)
 * Rename display_list module so not getting display_list.display_list ?
 * Move node into app.node ?, util.timer and util.fixed_rate_timer?
 * Combine dispatch and event dispatch
 
 * Move app reference from window.app to just a app as a singleton in the module
 * Maybe remove letter.js and just have app.launch ? or keep as letter.all to import in one line?
 
 * Add support for rect, circle, label within animation clip data (eg. clip_frame.add_label_content)
 * During animation reuse of frames, check that types match as well as instance name