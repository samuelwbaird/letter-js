'use strict';
// boot strapping for letter-js code loading and shared structures over plain JS
// copyright 2016 Samuel Baird MIT Licence


// going to be placing some stuff into global namespace
var global = window

// -- allow arbitrary objects to be tagged with a property that can be used as a string key for dicts ------
// associate a unique string tag with an object to use as a key in obj-> refs
// eg. collection[tag(something)] = new_stuff_to_do_with_something;

var tag_no = 0;
global.tag = function (object) {
	if (typeof object == 'string') {
		return object;
	}
	if (object._tag) {
		return object._tag;
	}
	var tag = ':tag:' + (++tag_no);
	object._tag = tag;
	return tag;
}

// -- array prototype iterate shim ----------------------------------------

Array.prototype.with_each = function (callback) {
	for (var i = 0, j = this.length; i < j; i++) {
		callback(this[i]);
	}
}

Object.prototype.with_each = function (callback) {
	var keys = Object.keys(this);
	for (var i = 0, j = keys.length; i < j; i++) {
		var key = keys[i];
		callback(key, this[key]);
	}
}

// -- a class/object/constructor implementation pattern -------------------

global.klass = function (class_constructor) {
	var constructor = function () {  
		// init method called as an instance constructor if supplied
		if (constructor.prototype.init !== undefined) {
			constructor.prototype.init.apply(this, arguments)
		}
	};
		
	constructor.prototype = {}
	constructor.prototype.constructor = constructor;
	
	class_constructor(constructor.prototype);
	return constructor;
};

global.modul = function (module_constructor) { var mod = {}; module_constructor(mod); return mod; }

// -- create a derived class (not really inherited) -------------------
// everything copied to the derived class, no chain

global.derive = function (base_class, class_constructor) {
	var constructor = function () {  
		// init method called as an instance constructor if supplied
		if (constructor.prototype.init !== undefined) {
			constructor.prototype.init.apply(this, arguments)
		}
	};
	
	// prepare the prototype, patching in the base class methods
	constructor.prototype = {};
	for (var key in base_class.prototype) {
		constructor.prototype[key] = base_class.prototype[key];
	}
	constructor.prototype.constructor = constructor;

	class_constructor(base_class.prototype, constructor.prototype);
	return constructor;
};

// -- wrap a method in a free standing function -------------

global.delegate = function (obj, method) {
	return function () { method.apply(obj, arguments); }
}

// -- cache results by key --------------------------

global.cache = klass(function (cache) {	
	cache.init = function (max_size) {
		this.max_size = max_size;
		this.lookup = {};
		this.queue = [];
	}
	
	cache.get = function (name) {
		return this.lookup[name];
	}
	
	cache.set = function (name, value) {
		if (this.max_size > 0 && this.queue.length >= this.max_size - 1) {
			var old_name = this.queue.unshift();
			this.lookup[old_name] = null;
		}
		
		this.queue.push(name);
		this.lookup[name] = value;
		return value;
	}
	
	cache.get_or_set = function (name, value_function) {
		var existing = this.lookup[name];
		if (existing != null && existing != undefined) {
			return existing;
		}
		
		return this.set(name, value_function());
	}		
});

// -- collection with tag/callback/expire behaviour ----------------

global.update_list = klass(function (update_list) {
	
	update_list.init = function () {
		this.list = [];
		// some kind of reverse look up for tags?
	}
	
	update_list.add = function (obj, tag) {
		this.list.push({
			obj : obj,
			tag : tag
		})
	}
	
	update_list.remove = function (tag) {
		if (this.is_iterating) {
			throw "remove during update/iteration";
		}
		
		var did_remove = false;
		var i = 0;
		while (i < this.list.length) {
			var entry = this.list[i];
			if (entry.tag == tag) {
				this.list.splice(i, 1);
				did_remove = true;
			} else {
				i++;
			}
		}
		
		return did_remove;
	}
	
	update_list.clear = function () {
		if (this.is_iterating) {
			throw "clear during update/iteration";
		}
		this.list = [];
	}
	
	update_list.is_clear = function () {
		return this.list.length == 0;
	}
	
	update_list.update = function (update_function) {
		if (this.is_iterating) {
			throw "update during update/iteration";
		}
		this.is_iterating = true;
		var i = 0;
		var length = this.list.length;
		while (i < length) {
			var entry = this.list[i];
			if (update_function(entry.obj) === true) {
				this.list.splice(i, 1);
				length--;
			} else {
				i++;
			}
		}
		this.is_iterating = false;
	}
	
});

// -- script loading and linking -----------------------------------

// get current script URL as base url for loading modules
var scripts = document.getElementsByTagName('script');
var base_url = scripts[scripts.length - 1].src;
base_url = base_url.substr(0, base_url.length - 'letter.js'.length);
console.log('letter: base_url ' + base_url);

// retain and register loaded/loading modules
var lt_loaded = {}
var loading_stack = []
var define_name_stack = []

var load_script_async = function (src, callback) {
	console.log('letter: load script ' + src);
    var s = document.createElement('script');
    s.src = src;
    s.type = "text/javascript";
    s.async = true;
	s.onload = function () {
		callback (s);
	};
    document.getElementsByTagName('head')[0].appendChild(s);
}

global.queue_load = function (assign_name, module_names, callback) {
	var initial_length = loading_stack.length;
	loading_stack.push({
		assign_name : assign_name, 
		module_names : module_names,
		callback : callback
	});
	load_and_assign_all();
	// return success if no additional loading was required
	return loading_stack.length < initial_length.length;
}

global.load_and_assign_all = function () {
	// go through all queued loads
	// substitude modules for strings where they exist
	// kick off loads for everything that is still a string
	
	var i = loading_stack.length;
	while (--i >= 0) {
		var load = loading_stack[i];
		var module_names = load.module_names;
		var is_ready = true;
		
		// load or assign modules as needed
		for (var j = 0; j < module_names.length; j++) {
			var module_name = module_names[j];
			
			if (typeof module_name == 'string') {
				var entry = lt_loaded[module_name];
				if (entry === undefined) {
					var src = base_url + module_name.replace('.', '/') + '.js';
					lt_loaded[module_name] = {
						name : module_name,
						src : src,
						object : null,
					}
				
					define_name_stack.push(module_name);
					load_script_async(src, function () {
						global.load_and_assign_all();
					});
					is_ready = false;
					return false;
					
				} else if (entry.object) {
					module_names[j] = entry.object
					
				} else {
					is_ready = false;
					return false;
				}
			}
		}
		
		if (is_ready) {
			loading_stack.splice(i, 1);
			if (load.assign_name) {
				lt_loaded[load.assign_name].object = {};
				lt_loaded[load.assign_name].object = load.callback.apply(null, module_names);
			} else if (load.callback) {
				load.callback.apply(null, module_names);
			}
		}
	}
	
	return true;
}

global.define = function (module_names, callback) {
	var name = define_name_stack.pop();
	return global.queue_load(name, module_names, callback);
}

global.require = function (module_names, callback) {
	return global.queue_load(null, module_names, callback);
}

global.resolve = function (module_name) {
	var entry = lt_loaded[module_name]
	if (entry && entry.object) {
		return entry.object;
	}
	throw module_name + ' is not loaded';
}