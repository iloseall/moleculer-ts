/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type { CacherOptions } from "./base";

declare namespace RedisCacher {
	export interface RedisCacherOptions extends CacherOptions {
		prefix?: string;
		redis?: Record<string, any> | string;
		cluster?: Record<string, any> | boolean;
		redlock?: Record<string, any> | boolean;
		monitor?: boolean;
		pingInterval?: number;
		serializer?: string | Record<string, any>;
	}
}

let R;

import BaseCacher from "./base";
import _ from "lodash";
import { METRIC } from "../metrics";
import { BrokerOptionsError } from "../errors";
import Serializers from "../serializers";
import * as C from "../constants";

/**
 * Cacher factory for Redis
 *
 */
class RedisCacher<TClient = any> extends BaseCacher<RedisCacher.RedisCacherOptions> {
	client: TClient;
	serializer: any;
	pingTimer: NodeJS.Timeout;
	pingIntervalHandle: NodeJS.Timeout;
	redlock: any;
	redlockNonBlocking: any;
	/**
	 * Creates an instance of RedisCacher.
	 *
	 * @param {RedisCacherOptions} opts
	 *
	 * @memberof RedisCacher
	 */
	constructor(opts?: any) {
		if (typeof opts === "string") opts = { redis: opts };

		super(opts);

		this.opts = _.defaultsDeep(this.opts, {
			prefix: null,
			pingInterval: null
		});

		this.pingIntervalHandle = null;

		/**
		 * Redlock client instance
		 * @memberof RedisCacher
		 */
		this.redlock = null;
		this.redlockNonBlocking = null;
	}

	/**
	 * Initialize cacher. Connect to Redis server
	 *
	 * @param {ServiceBroker} broker
	 *
	 * @memberof RedisCacher
	 */
	init(broker) {
		super.init(broker);
		try {
			R = require("ioredis");
		} catch (err) {
			/* istanbul ignore next */
			this.broker.fatal(
				"The 'ioredis' package is missing. Please install it with 'npm install ioredis --save' command.",
				err,
				true
			);
		}

		/**
		 * ioredis client instance
		 * @memberof RedisCacher
		 */
		const clusterOpts = this.opts.cluster as Record<string, any> | undefined;
		if (clusterOpts) {
			if (!clusterOpts.nodes || clusterOpts.nodes.length === 0) {
				throw new BrokerOptionsError("There is no 'nodes' configuration for cluster.");
			}

			this.client = new R.Cluster(clusterOpts.nodes, clusterOpts.options);
		} else {
			this.client = new R.Redis(this.opts.redis);
		}

		this.connected = false;

		(this.client as any).on("ready", () => {
			this.connected = true;

			/* istanbul ignore next */
			this.logger.info("Redis cacher connected.");
		});

		(this.client as any).on("error", err => {
			this.connected = false;

			this.broker.broadcastLocal("$cacher.error", {
				error: err,
				module: "cacher",
				type: C.CLIENT_ERROR
			});

			/* istanbul ignore next */
			this.logger.error(err);
		});

		// check for !== false for backwards compatibility purposes; should be changed to opt-in in a breaking change release
		if (this.opts.redlock !== false) {
			let Redlock;
			try {
				Redlock = require("redlock");
			} catch {
				Redlock = null;
			}
			if (Redlock != null) {
				const redlockOpts = this.opts.redlock as Record<string, any> | undefined;
				const redlockClients = (redlockOpts ? redlockOpts.clients : null) || [this.client];

				this.redlock = new Redlock(redlockClients, _.omit(this.opts.redlock, ["clients"]));
				// Non-blocking redlock client, used for tryLock()
				this.redlockNonBlocking = new Redlock(redlockClients, {
					retryCount: 0
				});
			}
		}

		if (this.opts.monitor) {
			/* istanbul ignore next */
			(this.client as any).monitor((err, monitor) => {
				this.logger.debug("Redis cacher entering monitoring mode...");
				monitor.on("monitor", (time, args /*, source, database*/) => {
					this.logger.debug(args);
				});
			});
		}

		// create an instance of serializer (default to JSON)
		this.serializer = Serializers.resolve(this.opts.serializer);
		this.serializer.init(this.broker);

		// add interval for ping if set
		if (this.opts.pingInterval > 0) {
			this.pingTimer = setInterval(() => {
				(this.client as any)
					.ping()
					.then(() => {
						this.connected = true;

						this.logger.debug("Sent PING to Redis Server");
					})
					.catch(err => {
						this.connected = false;

						this.broker.broadcastLocal("$cacher.error", {
							error: err,
							module: "cacher",
							type: C.FAILED_SEND_PING
						});

						this.logger.error("Failed to send PING to Redis Server", err);
					});
			}, Number(this.opts.pingInterval));
		}

		this.logger.debug("Redis Cacher created. Prefix: " + this.prefix);
	}

	/**
	 * Close Redis client connection
	 *
	 * @memberof RedisCacher
	 */
	close(): Promise<void> {
		if (this.pingTimer != null) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
		return this.client != null ? (this.client as any).quit() : Promise.resolve();
	}

	/**
	 * Get data from cache by key
	 *
	 * @param {any} key
	 * @returns {Promise}
	 *
	 * @memberof Cacher
	 */
	get(key: string): Promise<Record<string, unknown> | null> {
		this.logger.debug(`GET ${key}`);
		this.metrics.increment(METRIC.MOLECULER_CACHER_GET_TOTAL);
		const timeEnd = this.metrics.timer(METRIC.MOLECULER_CACHER_GET_TIME);

		return (this.client as any).getBuffer(this.prefix + key).then(data => {
			if (data) {
				this.logger.debug(`FOUND ${key}`);
				this.metrics.increment(METRIC.MOLECULER_CACHER_FOUND_TOTAL);

				try {
					const res = this.serializer.deserialize(data);
					timeEnd();

					return res;
				} catch (err) {
					this.logger.error("Redis result parse error.", err, data);
				}
			}
			timeEnd();
			return this.opts.missingResponse;
		});
	}

	/**
	 * Save data to cache by key
	 *
	 * @param {String} key
	 * @param {any} data JSON object
	 * @param {Number} ttl Optional Time-to-Live
	 * @returns {Promise}
	 *
	 * @memberof Cacher
	 */
	set(key: string, data: any, ttl?: number): Promise<void> {
		this.metrics.increment(METRIC.MOLECULER_CACHER_SET_TOTAL);
		const timeEnd = this.metrics.timer(METRIC.MOLECULER_CACHER_SET_TIME);

		data = this.serializer.serialize(data);
		this.logger.debug(`SET ${key}`);

		if (ttl == null) ttl = this.opts.ttl;

		let p;
		if (ttl) {
			p = (this.client as any).set(this.prefix + key, data, "EX", ttl);
		} else {
			p = (this.client as any).set(this.prefix + key, data);
		}

		return p
			.then(res => {
				timeEnd();
				return res;
			})
			.catch(err => {
				timeEnd();
				throw err;
			});
	}

	/**
	 * Delete a key from cache
	 *
	 * @param {string|Array<string>} deleteTargets
	 * @returns {Promise}
	 *
	 * @memberof Cacher
	 */
	del(deleteTargets) {
		this.metrics.increment(METRIC.MOLECULER_CACHER_DEL_TOTAL);
		const timeEnd = this.metrics.timer(METRIC.MOLECULER_CACHER_DEL_TIME);

		deleteTargets = Array.isArray(deleteTargets) ? deleteTargets : [deleteTargets];
		const keysToDelete = deleteTargets.map(key => this.prefix + key);

		this.logger.debug(`DELETE ${keysToDelete}`);
		return (this.client as any)
			.del(keysToDelete)
			.then(res => {
				timeEnd();
				return res;
			})
			.catch(err => {
				timeEnd();
				this.logger.error(`Redis 'del' error. Key: ${keysToDelete}`, err);
				throw err;
			});
	}

	/**
	 * Clean cache. Remove every key by prefix
	 *        http://stackoverflow.com/questions/4006324/how-to-atomically-delete-keys-matching-a-pattern-using-redis
	 * alternative solution:
	 *        https://github.com/cayasso/cacheman-redis/blob/master/lib/index.js#L125
	 * @param {String|Array<String>} match Match string for SCAN. Default is "*"
	 * @returns {Promise}
	 *
	 * @memberof Cacher
	 */
	clean(match: string | string[] = "**"): Promise<void> {
		this.metrics.increment(METRIC.MOLECULER_CACHER_CLEAN_TOTAL);
		const timeEnd = this.metrics.timer(METRIC.MOLECULER_CACHER_CLEAN_TIME);

		const cleaningPatterns = Array.isArray(match) ? match : [match];
		const normalizedPatterns = cleaningPatterns.map(
			match => this.prefix + match.replace(/\*\*/g, "*")
		);
		this.logger.debug(`CLEAN ${match}`);
		return this._sequentialPromises(normalizedPatterns)
			.then(res => {
				timeEnd();
				return res;
			})
			.catch(err => {
				timeEnd();
				this.logger.error(`Redis 'scanDel' error. Pattern: ${err.pattern}`, err);
				throw err;
			});
	}

	/**
	 * Get data and ttl from cache by key.
	 *
	 * @param {string|Array<string>} key
	 * @returns {Promise}
	 *
	 * @memberof RedisCacher
	 */
	getWithTTL(key: string): Promise<Record<string, unknown> | null> {
		return (this.client as any)
			.pipeline()
			.getBuffer(this.prefix + key)
			.ttl(this.prefix + key)
			.exec()
			.then(([resBuffer, resTTL]) => {
				// eslint-disable-next-line prefer-const -- `data` is reassigned below
				let [err0, data] = resBuffer;
				const [err1, ttl] = resTTL;

				if (err0) {
					return this.broker.Promise.reject(err0);
				}
				if (err1) {
					return this.broker.Promise.reject(err1);
				}

				if (data) {
					this.logger.debug(`FOUND ${key}`);
					try {
						data = this.serializer.deserialize(data);
					} catch (err) {
						this.logger.error("Redis result parse error.", err, data);
						data = this.opts.missingResponse;
					}
				}
				return { data, ttl };
			});
	}

	/**
	 * Acquire a lock
	 *
	 * @param {string|Array<string>} key
	 * @param {Number} ttl Optional Time-to-Live
	 * @returns {Promise}
	 *
	 * @memberof RedisCacher
	 */
	lock(key: string | string[], ttl?: number): Promise<() => Promise<void>> {
		if (this.redlock == null) {
			return this._handleMissingRedlock();
		}

		key = this.prefix + key + "-lock";
		return this.redlock.lock(key, ttl).then(lock => {
			return () => lock.unlock();
		});
	}

	/**
	 * Try to acquire a lock
	 *
	 * @param {string|Array<string>} key
	 * @param {Number} ttl Optional Time-to-Live
	 * @returns {Promise}
	 *
	 * @memberof RedisCacher
	 */
	tryLock(key: string | string[], ttl?: number): Promise<() => Promise<void>> {
		if (this.redlockNonBlocking == null) {
			return this._handleMissingRedlock();
		}

		key = this.prefix + key + "-lock";
		return this.redlockNonBlocking.lock(key, ttl).then(lock => {
			return () => lock.unlock();
		});
	}

	/**
	 * Common code for handling unavailable Redlock
	 * @returns {Promise}
	 */
	_handleMissingRedlock(): Promise<any> {
		this.logger.error(
			"The 'redlock' package is missing or redlock is disabled. If you want to enable cache lock, please install it with 'npm install redlock --save' command."
		);
		return Promise.resolve();
	}

	_sequentialPromises(elements) {
		return elements.reduce((chain, element) => {
			return chain.then(() => this._scanDel(element));
		}, this.broker.Promise.resolve());
	}

	_clusterScanDel(pattern) {
		const scanDelPromises = [];
		// get only master nodes to scan for deletion,
		// if we get slave nodes, it would be failed for deletion.
		const nodes = (this.client as any).nodes("master");

		nodes.forEach(node => {
			scanDelPromises.push(this._nodeScanDel(node, pattern));
		});

		return this.broker.Promise.all(scanDelPromises);
	}

	_nodeScanDel(node, pattern): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const stream = node.scanStream({
				match: pattern,
				count: 100
			});

			stream.on("data", (keys = []) => {
				if (!keys.length) {
					return;
				}

				stream.pause();
				node.del(keys)
					.then(() => {
						stream.resume();
					})
					.catch(err => {
						err.pattern = pattern;
						return reject(err);
					});
			});

			stream.on("error", err => {
				this.logger.error(`Error occured while deleting keys '${pattern}' from node.`, err);
				reject(err);
			});

			stream.on("end", () => {
				// End deleting keys from node
				resolve();
			});
		});
	}

	_scanDel(pattern) {
		if (this.client instanceof R.Cluster) {
			return this._clusterScanDel(pattern);
		} else {
			return this._nodeScanDel(this.client, pattern);
		}
	}

	/**
	 * Return all cache keys with available properties (ttl, lastUsed, ...etc).
	 *
	 * @returns Promise<Array<Object>>
	 */
	getCacheKeys(): Promise<Array<any>> {
		return new Promise<Array<any>>((resolve, reject) => {
			const res = [];

			const stream = (this.client as any).scanStream({
				match: this.prefix + "*",
				count: 100
			});

			stream.on("data", (keys = []) => res.push(...keys));

			stream.on("error", err => {
				this.logger.error("Error occured while listing keys from node.", err);
				reject(err);
			});

			stream.on("end", () => {
				// End deleting keys from node
				resolve(
					res.map(key => ({
						key: key.startsWith(this.prefix) ? key.slice(this.prefix.length) : key
					}))
				);
			});
		});
	}
}

export = RedisCacher;
