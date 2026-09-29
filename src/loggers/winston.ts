/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type LoggerFactory from "../logger-factory";
import type { LoggerOptions } from "./base";

declare namespace WinstonLogger {
	export interface WinstonLoggerOptions extends LoggerOptions {
		winston: {
			level?: string;
			[key: string]: any;
		};
	}
}

import BaseLogger from "./base";
import _ from "lodash";
import { isFunction } from "../utils";

/**
 * Winston logger for Moleculer
 *
 * https://github.com/winstonjs/winston
 *
 * @class WinstonLogger
 * @extends {BaseLogger<WinstonLoggerOptions>}
 */
class WinstonLogger extends BaseLogger<WinstonLogger.WinstonLoggerOptions> {
	winston: any;
	/**
	 * Creates an instance of WinstonLogger.
	 * @param {WinstonLoggerOptions} opts
	 * @memberof WinstonLogger
	 */
	constructor(opts) {
		super(opts);

		/** @type {WinstonLoggerOptions} */
		this.opts = _.defaultsDeep(this.opts, {
			winston: {
				level: "silly"
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
			this.winston = require("winston").createLogger(this.opts.winston);
		} catch (err) {
			/* istanbul ignore next */
			this.broker.fatal(
				"The 'winston' package is missing! Please install it with 'npm install winston --save' command!",
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
		const level = bindings ? this.getLogLevel(bindings.mod) : null;
		if (!level) return null;

		const levelIdx = BaseLogger.LEVELS.indexOf(level);

		const logger = isFunction(this.opts.createLogger)
			? this.opts.createLogger(level, bindings)
			: this.winston.child({ level, ...bindings });

		return (type, args) => {
			const typeIdx = BaseLogger.LEVELS.indexOf(type);
			if (typeIdx > levelIdx) return;

			switch (type) {
				case "info":
					return logger.info(...args);
				case "fatal":
				case "error":
					return logger.error(...args);
				case "warn":
					return logger.warn(...args);
				case "debug":
					return logger.debug(...args);
				case "trace":
					return logger.log("silly", ...args);
				default: {
					/* istanbul ignore next*/
					if (logger[type]) return logger[type](...args);

					/* istanbul ignore next*/
					return logger.info(...args);
				}
			}
		};
	}
}

export = WinstonLogger;
