/*
 * moleculer
 * Copyright (c) 2021 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import _mbo0s = require("../utils");
const { isFunction } = _mbo0s;

function ValidatorMiddleware(broker) {
	if (broker.validator && isFunction(broker.validator.middleware)) {
		return broker.validator.middleware(broker);
	}

	return null;
}

export = ValidatorMiddleware;
