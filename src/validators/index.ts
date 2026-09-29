/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import { isObject, isString, isInheritedClass } from "../utils";
import { BrokerOptionsError } from "../errors";

import Validator = require("./base");
import FastestValidator = require("./fastest");

const Validators = {
	Base: Validator,
	Fastest: FastestValidator
};

function getByName(name: any) {
	/* istanbul ignore next */
	if (!name) return null;

	const n = Object.keys(Validators).find(n => n.toLowerCase() == name.toLowerCase());
	if (n) return Validators[n];
}

/**
 * Resolve validator by name
 *
 * @param {Record<string,any>|string} opt
 * @returns {any}
 * @memberof ServiceBroker
 */
function resolve(opt: Record<string, any> | string): Validator {
	if (isObject(opt) && isInheritedClass(opt, Validators.Base)) {
		return opt as unknown as Validator;
	} else if (isString(opt)) {
		const ValidatorClass = getByName(opt);
		if (ValidatorClass) return new ValidatorClass();

		throw new BrokerOptionsError(`Invalid Validator type '${opt}'.`, { type: opt });
	} else if (isObject(opt)) {
		const opt2 = opt as Record<string, any>;
		const ValidatorClass = getByName(opt2.type || "Fastest");
		if (ValidatorClass) return new ValidatorClass(opt2.options);
		else
			throw new BrokerOptionsError(`Invalid Validator type '${opt2.type}'.`, {
				type: opt2.type
			});
	}

	return new Validators.Fastest();
}

/**
 * Register a custom validator
 *
 * @param {string} name
 * @param {any} value
 */
function register(name: string, value: Validator) {
	Validators[name] = value;
}

export = Object.assign(Validators, { resolve, register });
