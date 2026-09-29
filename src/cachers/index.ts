/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { isObject, isString, isInheritedClass } from "../utils";
import { BrokerOptionsError } from "../errors";

import BaseCacher from "./base";
import MemoryCacher from "./memory";
import MemoryLRUCacher from "./memory-lru";
import RedisCacher from "./redis";

/**
 * Mutable registry of the built-in cachers.
 *
 * It is exported with `export =` so that `register()` keeps adding new entries to
 * the very same object the consumer received from `require("moleculer").Cachers`.
 */
const Cachers: {
	Base: typeof BaseCacher;
	Memory: typeof MemoryCacher;
	MemoryLRU: typeof MemoryLRUCacher;
	Redis: typeof RedisCacher;
	resolve: typeof resolve;
	register: typeof register;
	[key: string]: any;
} = {
	Base: BaseCacher,
	Memory: MemoryCacher,
	MemoryLRU: MemoryLRUCacher,
	Redis: RedisCacher,
	resolve,
	register
};

/**
 * Type surface of the exported object, so `Cachers.Memory` stays usable as a
 * type by TypeScript consumers.
 */
declare namespace Cachers {
	export type Base<TOptions = any> = BaseCacher<TOptions>;
	export type Memory = MemoryCacher;
	export type MemoryLRU = MemoryLRUCacher;
	export type Redis<TClient = any> = RedisCacher<TClient>;
}

function getByName(name: any) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Cachers).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Cachers[n];
}

/**
 * Resolve cacher by name
 *
 * @param {Record<string,any>|string|boolean} opt
 * @returns {any}
 */
function resolve(opt: Record<string, any> | string | boolean): BaseCacher<any> {
	if (isObject(opt) && isInheritedClass(opt, Cachers.Base)) {
		return opt as unknown as BaseCacher<any>;
	} else if (opt === true) {
		return new Cachers.Memory({});
	} else if (isString(opt)) {
		let CacherClass = getByName(opt);
		if (CacherClass) return new CacherClass();

		if (opt.startsWith("redis://") || opt.startsWith("rediss://")) CacherClass = Cachers.Redis;

		if (CacherClass) return new CacherClass(opt);
		else throw new BrokerOptionsError(`Invalid cacher type '${opt}'.`, { type: opt });
	} else if (isObject(opt)) {
		const opt2 = opt as Record<string, any>;
		const CacherClass = getByName(opt2.type || "Memory");
		if (CacherClass) return new CacherClass(opt2.options);
		else
			throw new BrokerOptionsError(`Invalid cacher type '${opt2.type}'.`, {
				type: opt2.type
			});
	}

	/* istanbul ignore next */
	return null;
}

function register(name: string, value: BaseCacher<any>) {
	Cachers[name] = value;
}

export = Cachers;
