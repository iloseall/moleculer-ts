/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type LoggerFactory from "../logger-factory";
import type { LoggerOptions } from "./base";
import type { LoggerOptions as BunyanNativeLoggerOptions } from "bunyan";

declare namespace BunyanLogger {
	export interface BunyanLoggerOptions extends LoggerOptions {
		bunyan?: BunyanNativeLoggerOptions;
	}
}

import BaseLogger from "./base";
import _ from "lodash";
import { isFunction } from "../utils";

/**
 * Bunyan logger for Moleculer
 *
 * https://github.com/trentm/node-bunyan
 *
 * @class BunyanLogger
 */
class BunyanLogger extends BaseLogger<BunyanLogger.BunyanLoggerOptions> {
	bunyan: any;
	/**
	 * Creates an instance of BunyanLogger.
	 * @param {BunyanLoggerOptions} opts
	 * @memberof BunyanLogger
	 */
	constructor(opts) {
		super(opts);

		/** @type {BunyanLoggerOptions} */
		this.opts = _.defaultsDeep(this.opts, {
			bunyan: {
				name: "moleculer"
			}
		});
	}

	/**
	 * Initialize logger.
	 *
	 * @param {LoggerFactory} loggerFactory
	 */
	init(loggerFactory: LoggerFactory) {
		super.init(loggerFactory);

		try {
			this.bunyan = require("bunyan").createLogger(this.opts.bunyan);
		} catch (err) {
			/* istanbul ignore next */
			this.broker.fatal(
				"The 'bunyan' package is missing! Please install it with 'npm install bunyan --save' command!",
				err,
				true
			);
		}
	}

	/**
	 *
	 * @param {LoggerBindings?} bindings
	 */
	getLogHandler(bindings: LoggerFactory.LoggerBindings): BaseLogger.LogHandler | null {
		const level = bindings ? this.getLogLevel(bindings.mod) : null;
		if (!level) return null;

		const logger = isFunction(this.opts.createLogger)
			? this.opts.createLogger(level, bindings)
			: this.bunyan.child({ level, ...bindings });

		return (type, args) => logger[type](...args);
	}
}

export = BunyanLogger;
