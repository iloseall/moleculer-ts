/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type LoggerFactory from "../logger-factory";
import type { LogHandler } from "./base";
import type { FormattedLoggerOptions } from "./formatted";

declare namespace ConsoleLogger {
	export interface ConsoleLoggerOptions extends FormattedLoggerOptions {}
}

/* eslint-disable no-console */

import FormattedLogger from "./formatted";
import kleur from "kleur";

/**
 * Console logger for Moleculer
 *
 * @class ConsoleLogger
 * @extends {FormattedLogger<ConsoleLoggerOptions>}
 */
class ConsoleLogger extends FormattedLogger<ConsoleLogger.ConsoleLoggerOptions> {
	maxPrefixLength: number;
	/**
	 * Creates an instance of ConsoleLogger.
	 * @param {ConsoleLoggerOptions} opts
	 * @memberof ConsoleLogger
	 */
	constructor(opts) {
		super(opts);

		this.maxPrefixLength = 0;
	}

	/**
	 * Initialize logger.
	 *
	 * @param {LoggerFactory} loggerFactory
	 */
	init(loggerFactory: LoggerFactory) {
		super.init(loggerFactory);

		if (!this.opts.colors) kleur.enabled = false;
	}

	/**
	 *
	 * @param {LoggerBindings} bindings
	 */
	getLogHandler(bindings: LoggerFactory.LoggerBindings): LogHandler | null {
		const level = bindings ? this.getLogLevel(bindings.mod) : null;
		if (!level) return null;

		const levelIdx = FormattedLogger.LEVELS.indexOf(level);
		const formatter = this.getFormatter(bindings);

		return (type, args) => {
			const typeIdx = FormattedLogger.LEVELS.indexOf(type);
			if (typeIdx > levelIdx) return;

			const pargs = formatter(type, args);
			switch (type) {
				case "fatal":
				case "error":
					return console.error(...pargs);
				case "warn":
					return console.warn(...pargs);
				default:
					return console.log(...pargs);
			}
		};
	}
}

export = ConsoleLogger;
