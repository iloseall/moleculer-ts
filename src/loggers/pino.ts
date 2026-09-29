/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import LoggerFactory = require("../logger-factory");
import type { LoggerOptions } from "./base";
import type { DestinationStream } from "pino";

declare namespace PinoLogger {
	export interface PinoLoggerOptions extends LoggerOptions {
		pino?: {
			options: Record<string, any>;
			destination: DestinationStream;
		};
	}
}

import BaseLogger = require("./base");
import _ = require("lodash");
import { isFunction } from "../utils";

/**
 * Pino logger for Moleculer
 *
 * https://github.com/pinojs/pino
 *
 * @class PinoLogger
 * @extends {BaseLogger<PinoLoggerOptions>}
 */
class PinoLogger extends BaseLogger<PinoLogger.PinoLoggerOptions> {
	pino: any;
	/**
	 * Creates an instance of PinoLogger.
	 * @param {PinoLoggerOptions} opts
	 * @memberof PinoLogger
	 */
	constructor(opts) {
		super(opts);

		/** @type {PinoLoggerOptions} */
		this.opts = _.defaultsDeep(this.opts, {
			pino: {
				// http://getpino.io/#/docs/api?id=options-object
				options: null,
				// http://getpino.io/#/docs/api?id=destination-sonicboom-writablestream-string
				destination: null
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
			const Pino = require("pino").pino;
			this.pino = Pino(
				this.opts.pino?.options ?? undefined,
				this.opts.pino?.destination ?? undefined
			);
		} catch (err) {
			/* istanbul ignore next */
			this.broker.fatal(
				"The 'pino' package is missing! Please install it with 'npm install pino --save' command!",
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

		const logger = isFunction(this.opts.createLogger)
			? this.opts.createLogger(level, bindings)
			: this.pino.child(bindings, { level });

		return (type, args) => logger[type](...args);
	}
}

export = PinoLogger;
