/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { isObject, isString, isInheritedClass } from "../utils";
import { BrokerOptionsError } from "../errors";

import Base from "./base";
import Formatted from "./formatted";
import Bunyan from "./bunyan";
import Console from "./console";
import Datadog from "./datadog";
import Debug from "./debug";
import File from "./file";
import Log4js from "./log4js";
import Pino from "./pino";
import Winston from "./winston";

const Loggers = {
	Base,
	Formatted,

	Bunyan,
	Console,
	Datadog,
	Debug,
	File,
	Log4js,
	Pino,
	Winston,

	LEVELS: Base.LEVELS
};

function getByName(name: any) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Loggers).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Loggers[n];
}

/**
 * Resolve reporter by name
 *
 * @param {Record<string, any> | string} opt
 * @returns {any}
 */
function resolve(opt: Record<string, any> | string): Base<any> {
	if (isObject(opt) && isInheritedClass(opt, Loggers.Base)) {
		return opt as unknown as Base<any>;
	} else if (isString(opt)) {
		const LoggerClass = getByName(opt);
		if (LoggerClass) return new LoggerClass();
	} else if (isObject(opt)) {
		const opt2 = opt as Record<string, any>;
		const LoggerClass = getByName(opt2.type);
		if (LoggerClass) return new LoggerClass(opt2.options);
		else
			throw new BrokerOptionsError(`Invalid logger configuration. Type: '${opt2.type}'`, {
				type: opt2.type
			});
	}

	throw new BrokerOptionsError(`Invalid logger configuration: '${opt}'`, { type: opt });
}

function register(name: string, value: Base<any>) {
	Loggers[name] = value;
}

export = Object.assign(Loggers, { resolve, register });
