/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type ServiceBroker from "../service-broker";

declare namespace BaseValidator {
	export type ValidatorNames = "Fastest";

	export interface ValidatorOptions {
		paramName?: string;
	}

	type CheckerFunctionBase = (
		params: Record<string, unknown>,
		opts?: { meta: any }
	) => boolean | Promise<boolean>;
	export type CheckerFunction = CheckerFunctionBase & { async?: boolean };
}

import { ValidationError } from "../errors";
import _ from "lodash";

/**
 * Abstract validator class
 *
 */
class BaseValidator {
	broker: ServiceBroker;
	opts: BaseValidator.ValidatorOptions;
	/**
	 * Creates an instance of Validator.
	 *
	 * @param {ValidatorOptions} opts
	 *
	 * @memberof Cacher
	 */
	constructor(opts: BaseValidator.ValidatorOptions) {
		/** @type {ValidatorOptions} */
		this.opts = _.defaultsDeep(opts, {
			paramName: "params"
		});
	}

	/**
	 * Initialize cacher
	 *
	 * @param {ServiceBroker} broker
	 *
	 * @memberof Cacher
	 */
	init(broker: ServiceBroker) {
		this.broker = broker;
	}

	/**
	 * Compile a validation schema to a checker function.
	 *
	 * @param {Record<string, any>} schema
	 * @returns {CheckerFunction}
	 */
	compile(schema: Record<string, any>): BaseValidator.CheckerFunction {
		throw new Error("Abstract method");
	}

	/**
	 * Validate params againt the schema
	 *
	 * @param {Record<string, any>} params
	 * @param {Record<string, any>} schema
	 * @returns {boolean}
	 */
	validate(params: Record<string, any>, schema: Record<string, any>): boolean {
		throw new Error("Abstract method");
	}

	/**
	 * Convert the specific validation schema to
	 * the Moleculer (fastest-validator) validation schema format.
	 *
	 * @param {Record<string, any>} schema
	 * @returns {Object}
	 */
	convertSchemaToMoleculer(schema: any) {
		throw new Error("Abstract method");
	}

	/**
	 * Register validator as a middleware
	 *
	 * @param {ServiceBroker} broker
	 *
	 * @memberof BaseValidator
	 */
	middleware(broker: ServiceBroker) {
		const self = this;
		const paramName = this.opts.paramName;

		const processCheckResponse = function (ctx, handler, res, additionalInfo) {
			if (res === true) return handler(ctx);
			else {
				res = res.map(data => Object.assign(data, additionalInfo));
				return broker.Promise.reject(
					new ValidationError("Parameters validation error!", null, res)
				);
			}
		};

		return {
			name: "Validator",
			localAction: function validatorMiddleware(handler, action) {
				// Wrap a param validator
				if (action[paramName] && typeof action[paramName] === "object") {
					const check = self.compile(action[paramName]);
					return function validateContextParams(ctx) {
						const res = check(ctx.params != null ? ctx.params : {}, { meta: ctx });
						if (check.async)
							return (res as Promise<boolean>).then(res =>
								processCheckResponse(ctx, handler, res, {
									nodeID: ctx.nodeID,
									action: ctx.action.name
								})
							);
						else
							return processCheckResponse(ctx, handler, res, {
								nodeID: ctx.nodeID,
								action: ctx.action.name
							});
					};
				}
				return handler;
			},

			localEvent: function validatorMiddleware(handler, event) {
				// Wrap a param validator
				if (event[paramName] && typeof event[paramName] === "object") {
					const check = self.compile(event[paramName]);
					return function validateContextParams(ctx) {
						const res = check(ctx.params != null ? ctx.params : {}, { meta: ctx });

						if (check.async)
							return (res as Promise<boolean>).then(res =>
								processCheckResponse(ctx, handler, res, {
									nodeID: ctx.nodeID,
									event: ctx.event.name
								})
							);
						else
							return processCheckResponse(ctx, handler, res, {
								nodeID: ctx.nodeID,
								event: ctx.event.name
							});
					};
				}
				return handler;
			}
		};
	}
}

export = BaseValidator;
