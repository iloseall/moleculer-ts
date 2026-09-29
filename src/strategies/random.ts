/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type Endpoint from "../registry/endpoint";

import { random } from "lodash";
import BaseStrategy from "./base";

/**
 * Random strategy class
 *
 */
class RandomStrategy extends BaseStrategy {
	/**
	 * Select an endpoint.
	 *
	 * @param {Endpoint[]} list
	 *
	 * @returns {Endpoint}
	 * @memberof BaseStrategy
	 */
	select(list: Endpoint[]) {
		return list[random(0, list.length - 1)];
	}
}

export = RandomStrategy;
