/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import LoggerFactory = require("../logger-factory");
import ServiceBroker = require("../service-broker");

declare namespace BaseLogger {
	export type LogLevels = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

	export type LogHandler = (level: LogLevels, args: unknown[]) => void;

	export interface LoggerOptions {
		level?: LogLevels;
		createLogger?: Function;
	}

	// export const BaseLogger;
}

import _ = require("lodash");
import { match, isObject, isString } from "../utils";

const LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"];

/**
 * Logger base class.
 *
 */
class BaseLogger<TOptions extends BaseLogger.LoggerOptions> {
	loggerFactory: LoggerFactory;
	broker: ServiceBroker;
	Promise: typeof Promise;
	static LEVELS: string[];
	opts: TOptions;
	/**
	 * Creates an instance of BaseLogger.
	 *
	 * @param {LoggerOptions} opts
	 * @memberof BaseLogger
	 */
	constructor(opts: TOptions) {
		/** @type {LoggerOptions} */
		this.opts = _.defaultsDeep(opts, {
			level: "info",
			createLogger: null
		});
		this.Promise = Promise; // default promise before logger is initialized
	}

	/**
	 * Initialize logger.
	 *
	 * @param {LoggerFactory} loggerFactory
	 */
	init(loggerFactory: LoggerFactory) {
		this.loggerFactory = loggerFactory;
		this.broker = this.loggerFactory.broker;
		this.Promise = this.broker.Promise;
	}

	/**
	 * Stopping logger
	 */
	stop(): void | Promise<void> {
		return this.Promise.resolve();
	}

	getLogLevel(mod: string): BaseLogger.LogLevels | null {
		mod = mod ? mod.toUpperCase() : "";

		const level = this.opts.level;
		if (isString(level)) return level;

		if (isObject(level)) {
			if (level[mod]) return level[mod];

			// Find with matching
			const key = Object.keys(level).find(m => match(mod, m) && m !== "**");
			if (key) return level[key];
			else if (level["**"]) {
				return level["**"];
			}
		}

		/* istanbul ignore next */
		return null;
	}

	/**
	 *
	 * @param {LoggerBindings?} bindings
	 */
	getLogHandler(bindings: LoggerFactory.LoggerBindings): BaseLogger.LogHandler | null {
		return null;
	}
}

BaseLogger.LEVELS = LEVELS;

export = BaseLogger;
