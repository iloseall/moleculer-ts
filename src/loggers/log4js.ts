/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import LoggerFactory = require("../logger-factory");
import type { LoggerOptions } from "./base";
import type { Configuration } from "log4js";

declare namespace Log4jsLogger {
	export interface Log4jsLoggerOptions extends LoggerOptions {
		log4js?: Configuration;
	}
}

import BaseLogger = require("./base");
import _ = require("lodash");
import { isFunction } from "../utils";

/**
 * Log4js logger for Moleculer
 *
 * https://github.com/log4js-node/log4js-node
 *
 * @class Log4jsLogger
 * @extends {BaseLogger<Log4jsLoggerOptions>}
 */
class Log4jsLogger extends BaseLogger<Log4jsLogger.Log4jsLoggerOptions> {
	log4js: any;
	/**
	 * Creates an instance of Log4jsLogger.
	 * @param {Log4jsLoggerOptions} opts
	 * @memberof Log4jsLogger
	 */
	constructor(opts) {
		super(opts);

		/** @type {Log4jsLoggerOptions} */
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
			this.log4js = require("log4js");
			if (this.opts.log4js) {
				this.log4js.configure(this.opts.log4js);
			}
		} catch (err) {
			/* istanbul ignore next */
			this.broker.fatal(
				"The 'log4js' package is missing! Please install it with 'npm install log4js --save' command!",
				err,
				true
			);
		}
	}

	/**
	 * Stopping logger
	 */
	stop(): Promise<void> {
		if (this.log4js) {
			return new Promise<void>(resolve => this.log4js.shutdown(resolve));
		}

		return Promise.resolve();
	}

	/**
	 *
	 * @param {object} bindings
	 */
	getLogHandler(bindings: LoggerFactory.LoggerBindings): BaseLogger.LogHandler | null {
		const level = bindings ? this.getLogLevel(bindings.mod) : null;
		if (!level) return null;

		let logger;
		if (isFunction(this.opts.createLogger)) logger = this.opts.createLogger(level, bindings);
		else {
			logger = this.log4js.getLogger(bindings.mod.toUpperCase());
			logger.level = level;
		}

		return (type, args) => logger[type](...args);
	}
}

export = Log4jsLogger;
