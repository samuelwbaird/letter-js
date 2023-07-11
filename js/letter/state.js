// different state machines and managers
// copyright 2020 Samuel Baird MIT Licence

class KeyedSwitch {

	constructor (initSwitchList) {
		this.currentSwitch = null;
		this.switchList = [];

		if (initSwitchList) {
			for (const { key, action } of initSwitchList) {
				this.add(key, action);
			}
		}
	}

	add (key, action) {
		this.switchList.push({
			key: key,
			action: action,
		});
	}

	update () {
		for (const { key, action } of this.switchList) {
			const result = key();
			if (result != null) {
				if (result != this.currentSwitch) {
					console.log('switch to ' + result);
					this.currentSwitch = result;
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

export { KeyedSwitch };
