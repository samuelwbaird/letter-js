# letter-js
A partial port of letter, to plain old JS

This was an experiment in providing something similar to the display list code built in letter, running on Love2D, for plain old JS and canvas instead.

Not all concepts translate nicely, and performance is poor.

There is also a different approach to loading and requiring code. Resources are loaded using methods without callbacks, keep calling the method as part of the frame timer until it returns true to indicate the resources are ready.

As part of building only on plain JS there is a basic module loader in the style of require JS and some very thin class and module structures.
