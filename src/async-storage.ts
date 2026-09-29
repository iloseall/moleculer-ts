/*
 * moleculer
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import ServiceBroker = require("./service-broker");

import asyncHooks = require("async_hooks");
const executionAsyncId = asyncHooks.executionAsyncId;

class AsyncStorage {
	broker: ServiceBroker;
	store: Map<any, any>;
	hook: any;
	executionAsyncId: any;
	constructor(broker: ServiceBroker) {
		this.broker = broker;

		this.hook = asyncHooks.createHook({
			init: this._init.bind(this),
			//before: this._before.bind(this),
			//after: this._after.bind(this),
			destroy: this._destroy.bind(this),
			promiseResolve: this._destroy.bind(this)
		});

		this.executionAsyncId = executionAsyncId;

		this.store = new Map();
	}

	enable() {
		this.hook.enable();
	}

	disable() {
		this.hook.disable();
	}

	stop() {
		this.hook.disable();
		this.store.clear();
	}

	getAsyncId(): number {
		return executionAsyncId();
	}

	setSessionData(data: any) {
		const currentUid = executionAsyncId();
		this.store.set(currentUid, {
			data,
			owner: currentUid
		});
	}

	getSessionData(): any | null {
		const currentUid = executionAsyncId();
		const item = this.store.get(currentUid);
		return item ? item.data : null;
	}

	_init(asyncId, type, triggerAsyncId) {
		// Skip TIMERWRAP type
		if (type === "TIMERWRAP") return;

		const item = this.store.get(triggerAsyncId);
		if (item) {
			this.store.set(asyncId, item);
		}
	}

	_destroy(asyncId) {
		const item = this.store.get(asyncId);
		if (item) {
			this.store.delete(asyncId);
			//if (item.owner == asyncId)
			//	item.data = null;
		}
	}
}

export = AsyncStorage;
