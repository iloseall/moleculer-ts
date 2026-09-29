/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type { MemoryCacherOptions } from "./memory";

declare namespace MemoryLRUCacher {
	export interface MemoryLRUCacherOptions extends MemoryCacherOptions {
		max?: number;
		ttl?: number;
	}
}

import _ = require("lodash");
import { isObject } from "../utils";
const utilsMatch = require("../utils").match;
import BaseCacher = require("./base");
import _0 = require("lru-cache");
const { LRUCache } = _0;
import _1 = require("../metrics");
const { METRIC } = _1;

import Lock = require("../lock");

/**
 * Cacher factory for memory cache
 *
 * @extends {BaseCacher<MemoryLRUCacherOptions>}
 */
class MemoryLRUCacher extends BaseCacher<MemoryLRUCacher.MemoryLRUCacherOptions> {
	cache: any;
	_lock: Lock;
	timer: NodeJS.Timeout;
	clone: (data: any) => any;
	/**
	 * Creates an instance of MemoryLRUCacher.
	 *
	 * @param {MemoryLRUCacherOptions?} opts
	 *
	 * @memberof MemoryLRUCacher
	 */
	constructor(opts?: MemoryLRUCacher.MemoryLRUCacherOptions) {
		super(opts);

		// Cache container
		this.cache = new LRUCache({
			max: this.opts.max ? this.opts.max : 1000,
			ttl: this.opts.ttl ? this.opts.ttl * 1000 : undefined,
			updateAgeOnGet: !!this.opts.ttl
		});

		// Async lock
		this._lock = new Lock();
		// Start TTL timer
		this.timer = setInterval(() => {
			/* istanbul ignore next */
			this.checkTTL();
		}, 30 * 1000);
		this.timer.unref();

		// Set cloning
		this.clone = this.opts.clone === true ? _.cloneDeep : this.opts.clone;
	}

	/**
	 * Initialize cacher
	 *
	 * @param {ServiceBroker} broker
	 *
	 * @memberof MemoryLRUCacher
	 */
	init(broker) {
		super.init(broker);

		this.connected = true;

		broker.localBus.on("$transporter.connected", () => {
			// Clear all entries after transporter connected. Maybe we missed some "cache.clear" events.
			return this.clean();
		});

		if (
			isObject(this.opts.lock) &&
			(this.opts.lock as any)?.enabled !== false &&
			(this.opts.lock as any).staleTime
		) {
			/* istanbul ignore next */
			this.logger.warn("setting lock.staleTime with MemoryLRUCacher is not supported.");
		}
	}

	/**
	 * Close cacher
	 *
	 * @memberof MemoryLRUCacher
	 */
	close(): Promise<void> {
		clearInterval(this.timer);
		return Promise.resolve();
	}

	/**
	 * Get data from cache by key
	 *
	 * @param {any} key
	 * @returns {Promise}
	 *
	 * @memberof MemoryLRUCacher
	 */
	get(key: string): Promise<Record<string, unknown> | null> {
		this.logger.debug(`GET ${key}`);
		this.metrics.increment(METRIC.MOLECULER_CACHER_GET_TOTAL);
		const timeEnd = this.metrics.timer(METRIC.MOLECULER_CACHER_GET_TIME);

		if (this.cache.has(key)) {
			this.logger.debug(`FOUND ${key}`);
			this.metrics.increment(METRIC.MOLECULER_CACHER_FOUND_TOTAL);

			const item = this.cache.get(key);
			const res = this.clone ? this.clone(item) : item;
			timeEnd();

			return this.broker.Promise.resolve(res);
		} else {
			timeEnd();
		}
		return this.broker.Promise.resolve(this.opts.missingResponse);
	}

	/**
	 * Save data to cache by key
	 *
	 * @param {String} key
	 * @param {any} data JSON object
	 * @param {Number} ttl Optional Time-to-Live
	 * @returns {Promise}
	 *
	 * @memberof MemoryLRUCacher
	 */
	set(key: string, data: any, ttl?: number): Promise<void> {
		this.metrics.increment(METRIC.MOLECULER_CACHER_SET_TOTAL);
		const timeEnd = this.metrics.timer(METRIC.MOLECULER_CACHER_SET_TIME);

		if (ttl == null) ttl = this.opts.ttl;

		data = this.clone ? this.clone(data) : data;

		this.cache.set(key, data, { ttl: ttl ? ttl * 1000 : 0 });

		timeEnd();
		this.logger.debug(`SET ${key}`);

		return this.broker.Promise.resolve(data);
	}

	/**
	 * Delete a key from cache
	 *
	 * @param {string|Array<string>} key
	 * @returns {Promise}
	 *
	 * @memberof MemoryLRUCacher
	 */
	del(key: string | string[]): Promise<void> {
		this.metrics.increment(METRIC.MOLECULER_CACHER_DEL_TOTAL);
		const timeEnd = this.metrics.timer(METRIC.MOLECULER_CACHER_DEL_TIME);

		const keys = Array.isArray(key) ? key : [key];
		keys.forEach(key => {
			this.cache.delete(key);
			this.logger.debug(`REMOVE ${key}`);
		});
		timeEnd();

		return this.broker.Promise.resolve();
	}

	/**
	 * Clean cache. Remove every key by match
	 * @param {string|Array<string>} match string. Default is "**"
	 * @returns {Promise}
	 *
	 * @memberof MemoryLRUCacher
	 */
	clean(match: string | string[] = "**"): Promise<void> {
		this.metrics.increment(METRIC.MOLECULER_CACHER_CLEAN_TOTAL);
		const timeEnd = this.metrics.timer(METRIC.MOLECULER_CACHER_CLEAN_TIME);

		const matches = Array.isArray(match) ? match : [match];
		this.logger.debug(`CLEAN ${matches.join(", ")}`);

		const keys = this.cache.keys();
		/** @type {any} */
		let key = keys.next();
		while (!key.done) {
			if (matches.some(m => utilsMatch(key.value, m))) {
				this.logger.debug(`REMOVE ${key.value}`);
				this.cache.delete(key.value);
			}
			key = keys.next();
		}
		timeEnd();

		return this.broker.Promise.resolve();
	}
	/**
	 * Get data and ttl from cache by key.
	 *
	 * @param {string|Array<string>} key
	 * @returns {Promise}
	 *
	 * @memberof MemoryLRUCacher
	 */
	getWithTTL(key: string): Promise<Record<string, unknown> | null> {
		// There are no way to get the ttl of LRU cache :(
		return this.get(key).then(data => {
			return { data, ttl: null };
		});
	}

	/**
	 * Acquire a lock
	 *
	 * @param {string|Array<string>} key
	 * @param {Number} ttl Optional Time-to-Live
	 * @returns {Promise}
	 *
	 * @memberof MemoryLRUCacher
	 */

	lock(key: string | string[], ttl?: number): Promise<() => Promise<void>> {
		return this._lock.acquire(key, ttl).then(() => {
			return () => this._lock.release(key);
		});
	}

	/**
	 * Try to acquire a lock
	 *
	 * @param {string|Array<string>} key
	 * @param {Number} ttl Optional Time-to-Live
	 * @returns {Promise}
	 *
	 * @memberof MemoryLRUCacher
	 */
	tryLock(key: string | string[], ttl?: number): Promise<() => Promise<void>> {
		if (this._lock.isLocked(key)) {
			return this.broker.Promise.reject(new Error("Locked."));
		}
		return this._lock.acquire(key, ttl).then(() => {
			return () => this._lock.release(key);
		});
	}

	/**
	 * Check & remove the expired cache items
	 *
	 * @memberof MemoryLRUCacher
	 */
	checkTTL() {
		this.cache.purgeStale();
	}

	/**
	 * Return all cache keys with available properties (ttl, lastUsed, ...etc).
	 *
	 * @returns Promise<Array<Object>>
	 */
	getCacheKeys() {
		const res = [];

		const keys = this.cache.keys();
		let key = keys.next();
		while (!key.done) {
			res.push({ key: key.value });
			key = keys.next();
		}

		return Promise.resolve(res);
	}
}

export = MemoryLRUCacher;
