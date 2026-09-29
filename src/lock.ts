/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

class Lock {
	locked: Map<string, any[]>;

	constructor() {
		this.locked = new Map();
	}

	acquire(key: string, ttl?: number): Promise<any> {
		let locked = this.locked.get(key);
		if (!locked) {
			// not locked
			locked = [];
			this.locked.set(key, locked);
			return Promise.resolve();
		} else {
			return new Promise(resolve => locked!.push(resolve));
		}
	}

	isLocked(key: string): boolean {
		return !!this.locked.get(key);
	}

	release(key: string): Promise<void> {
		const locked = this.locked.get(key);
		if (locked) {
			if (locked.length > 0) {
				locked.shift()!(); // Release the lock
			} else {
				this.locked.delete(key);
			}
		}
		return Promise.resolve();
	}
}

export = Lock;
