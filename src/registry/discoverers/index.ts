/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { BrokerOptionsError } from "../../errors";
import { isObject, isString, isInheritedClass } from "../../utils";

import BaseDiscoverer from "./base";
import LocalDiscoverer from "./local";
import Etcd3Discoverer from "./etcd3";
import RedisDiscoverer from "./redis";

const Discoverers = {
	Base: BaseDiscoverer,
	Local: LocalDiscoverer,
	Etcd3: Etcd3Discoverer,
	Redis: RedisDiscoverer
};

function getByName(name: any) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Discoverers).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Discoverers[n];
}

/**
 * Resolve discoverer by name
 *
 * @param {Record<string, any>|string} opt
 * @returns {any}
 */
function resolve(opt: Record<string, any> | string): BaseDiscoverer {
	if (isObject(opt) && isInheritedClass(opt, Discoverers.Base)) {
		return opt as unknown as BaseDiscoverer;
	} else if (isString(opt)) {
		const DiscovererClass = getByName(opt);
		if (DiscovererClass) return new DiscovererClass();

		if (opt.startsWith("redis://") || opt.startsWith("rediss://"))
			return new Discoverers.Redis(opt);

		if (opt.startsWith("etcd3://")) return new Discoverers.Etcd3(opt);

		throw new BrokerOptionsError(`Invalid Discoverer type '${opt}'.`, { type: opt });
	} else if (isObject(opt)) {
		const opt2 = opt as Record<string, any>;
		const DiscovererClass = getByName(opt2.type || "Local");
		if (DiscovererClass) return new DiscovererClass(opt2.options);
		else
			throw new BrokerOptionsError(`Invalid Discoverer type '${opt2.type}'.`, {
				type: opt2.type
			});
	}

	return new Discoverers.Local();
}

function register(name: string, value: BaseDiscoverer) {
	Discoverers[name] = value;
}

export = Object.assign(Discoverers, { resolve, register });
