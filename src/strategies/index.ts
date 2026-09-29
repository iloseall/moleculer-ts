/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { isObject, isString } from "../utils";
import { BrokerOptionsError } from "../errors";

import BaseStrategy = require("./base");
import RoundRobinStrategy = require("./round-robin");
import RandomStrategy = require("./random");
import CpuUsageStrategy = require("./cpu-usage");
import LatencyStrategy = require("./latency");
import ShardStrategy = require("./shard");

const Strategies = {
	Base: BaseStrategy,
	RoundRobin: RoundRobinStrategy,
	Random: RandomStrategy,
	CpuUsage: CpuUsageStrategy,
	Latency: LatencyStrategy,
	Shard: ShardStrategy
};

function getByName(name: any) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Strategies).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Strategies[n];
}

/**
 * Resolve strategy by name
 *
 * @param {Record<string, any>|string} opt
 * @returns {any}
 */
function resolve(opt: Record<string, any> | string) {
	if (Object.prototype.isPrototypeOf.call(Strategies.Base, opt)) {
		return opt;
	} else if (isString(opt)) {
		const StrategyClass = getByName(opt);
		if (StrategyClass) return StrategyClass;
		else throw new BrokerOptionsError(`Invalid strategy type '${opt}'.`, { type: opt });
	} else if (isObject(opt)) {
		const StrategyClass = getByName(opt.type || "RoundRobin");
		if (StrategyClass) return StrategyClass;
		else
			throw new BrokerOptionsError(`Invalid strategy type '${opt.type}'.`, {
				type: opt.type
			});
	}

	return Strategies.RoundRobin;
}

function register(name: string, value: BaseStrategy) {
	Strategies[name] = value;
}

export = Object.assign(Strategies, { resolve, register });
