/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type { ValidatorConstructorOptions } from "fastest-validator";

declare namespace FastestValidator {
	export type ValidatorNames = "Fastest";

	export interface FastestValidatorOptions
		extends ValidatorConstructorOptions, BaseValidator.ValidatorOptions {}
}

import FVModule = require("fastest-validator");
import { ValidationError } from "../errors";
import BaseValidator = require("./base");
import _ = require("lodash");

/**
 * `fastest-validator` ships ESM-style type definitions, but its CommonJS entry
 * exports the class directly, so it has to be unwrapped manually.
 */
const Validator = FVModule as unknown as typeof FVModule.default;

/**
 * Fastest validator class
 *
 */
class FastestValidator extends BaseValidator {
	opts: FastestValidator.FastestValidatorOptions;
	validator: FVModule.default;
	/**
	 * Creates an instance of FastestValidator.
	 *
	 * @param {FastestValidatorOptions} opts
	 *
	 */
	constructor(opts?: FastestValidator.FastestValidatorOptions) {
		super(opts);
		/** @type {FastestValidatorOptions} */
		this.opts = _.defaultsDeep(this.opts, {
			useNewCustomCheckerFunction: true
		});

		/** @type {Validator} */
		this.validator = new Validator(this.opts);
	}

	/**
	 * Compile a validation schema to a checker function.
	 * Need a clone because FV manipulate the schema (removing $$... props)
	 *
	 * @param {Record<string, any>} schema
	 * @returns {CheckerFunction}
	 */
	compile(schema): BaseValidator.CheckerFunction {
		return this.validator.compile(_.cloneDeep(schema)) as BaseValidator.CheckerFunction;
	}

	/**
	 * Validate params against the schema
	 *
	 * @param {Record<string, any>} params
	 * @param {Record<string, any>} schema
	 * @returns {boolean}
	 */
	validate(params, schema) {
		const res = this.validator.validate(params, _.cloneDeep(schema));
		if (res !== true) throw new ValidationError("Parameters validation error!", null, res);

		return true;
	}

	/**
	 * Convert the specific validation schema to
	 * the Moleculer (fastest-validator) validation schema format.
	 *
	 * @param {Record<string, any>} schema
	 * @returns {Object}
	 */
	convertSchemaToMoleculer(schema: any) {
		return schema;
	}
}

export = FastestValidator;
