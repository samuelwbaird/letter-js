// different state machines and managers
// copyright 2020 Samuel Baird MIT Licence

class keyed_switch {

	constructor (init_switch_list) {
		this.current_switch = null;
		this.switch_list = [];

		if (init_switch_list) {
			for (const { key, action } of init_switch_list) {
				this.add(key, action);
			}
		}
	}

	add (key, action) {
		this.switch_list.push({
			key: key,
			action: action,
		});
	}

	update () {
		for (const { key, action } of this.switch_list) {
			const result = key();
			if (result != null) {
				if (result != this.current_switch) {
					console.log('switch to ' + result);
					this.current_switch = result;
					action();
				}
				break;
			}
		}
	}

}

// machine
// list
// merge (function to merge a new object into an existing object retaining identities)

export { keyed_switch };