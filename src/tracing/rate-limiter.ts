/*
 * moleculer
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

declare namespace RateLimiter {
	export type RateLimiterOptions = {
		tracesPerSecond?: number;
	};
}

import _ from "lodash";

/**
 * Rate Limiter class for Tracing.
 *
 * Inspired by
 * 	https://github.com/jaegertracing/jaeger-client-node/blob/master/src/rate_limiter.js
 *
 * @class RateLimiter
 */
class RateLimiter {
	opts: RateLimiter.RateLimiterOptions;
	lastTime: number;
	balance: number;
	maxBalance: any;
	constructor(opts?: RateLimiter.RateLimiterOptions) {
		/** @type {RateLimiterOptions} */
		this.opts = _.defaultsDeep(opts, {
			tracesPerSecond: 1
		});

		this.lastTime = Date.now();
		this.balance = 0;
		this.maxBalance = this.opts.tracesPerSecond < 1 ? 1 : this.opts.tracesPerSecond;
	}

	check(cost: number = 1): boolean {
		const now = Date.now();
		const elapsedTime = (now - this.lastTime) / 1000;
		this.lastTime = now;

		this.balance += elapsedTime * this.opts.tracesPerSecond;
		if (this.balance > this.maxBalance) this.balance = this.maxBalance;

		if (this.balance >= cost) {
			this.balance -= cost;
			return true;
		}

		return false;
	}
}

export = RateLimiter;
