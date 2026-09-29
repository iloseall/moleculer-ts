/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import LoggerFactory = require("../logger-factory");
import type { LoggerOptions } from "./base";

declare namespace DebugLogger {
	export interface DebugLoggerOptions extends LoggerOptions {}
}

import BaseLogger = require("./base");
import _ = require("lodash");
import { isFunction } from "../utils";

/**
 * Debug logger for Moleculer
 *
 * https://github.com/visionmedia/debug
 *
 * @class DebugLogger
 * @extends {BaseLogger<DebugLoggerOptions>}
 */
class DebugLogger extends BaseLogger<DebugLogger.DebugLoggerOptions> {
	debug: any;
	/**
	 * Creates an instance of DebugLogger.
	 * @param {DebugLoggerOptions} opts
	 * @memberof DebugLogger
	 */
	constructor(opts) {
		super(opts);

		/** @type {DebugLoggerOptions} */
		this.opts = _.defaultsDeep(this.opts, {});
	}

	/**
	 * Initialize logger.
	 *
	 * @param {LoggerFactory} loggerFactory
	 */
	init(loggerFactory: LoggerFactory) {
		super.init(loggerFactory);

		try {
			this.debug = require("debug")("moleculer");
		} catch (err) {
			/* istanbul ignore next */
			this.broker.fatal(
				"The 'debug' package is missing! Please install it with 'npm install debug --save' command!",
				err,
				true
			);
		}
	}

	/**
	 *
	 * @param {LoggerBindings} bindings
	 */
	getLogHandler(bindings: LoggerFactory.LoggerBindings): BaseLogger.LogHandler | null {
		const mod = bindings ? bindings.mod : null;
		const level = this.getLogLevel(mod);
		if (!level) return null;

		const levelIdx = BaseLogger.LEVELS.indexOf(level);

		const logger = isFunction(this.opts.createLogger)
			? this.opts.createLogger(level, bindings)
			: this.debug.extend(mod);

		return (type, args) => {
			const typeIdx = BaseLogger.LEVELS.indexOf(type);
			if (typeIdx > levelIdx) return;

			return logger(...args);
		};
	}
}

export = DebugLogger;
