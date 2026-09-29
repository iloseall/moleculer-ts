import type { Logger } from "../../logger-factory";
import type Span = require("../span");
import type Tracer = require("../tracer");
import type ServiceBroker = require("../../service-broker");

declare namespace BaseTraceExporter {
	export interface BaseTraceExporterOptions {
		safetyTags?: boolean;
		logger?: Logger;
	}
}

import _ = require("lodash");
import { isObject, safetyObject } from "../../utils";

/**
 * Abstract Trace Exporter
 *
 * @class BaseTraceExporter
 */
class BaseTraceExporter {
	opts: any;
	tracer: Tracer;
	broker: ServiceBroker;
	logger: Logger;
	Promise: PromiseConstructor;
	/**
	 * Creates an instance of BaseTraceExporter.
	 * @param {BaseTraceExporterOptions?} opts
	 * @memberof BaseTraceExporter
	 */
	constructor(opts: BaseTraceExporter.BaseTraceExporterOptions) {
		/** @type {BaseTraceExporterOptions} */
		this.opts = _.defaultsDeep(opts, {
			safetyTags: false
		});
		this.Promise = Promise; // default promise before logger is initialized
	}

	/**
	 * Initialize Trace Exporter.
	 *
	 * @param {Tracer} tracer
	 * @memberof BaseTraceExporter
	 */
	init(tracer: Tracer) {
		this.tracer = tracer;
		this.broker = tracer.broker;
		this.Promise = this.broker.Promise;
		this.logger = this.opts.logger || this.tracer.logger;
	}

	/**
	 * Stop Trace exporter
	 */
	stop() {
		// Not implemented
	}

	/**
	 * Span is started.
	 *
	 * @param {Span} span
	 * @memberof BaseTraceExporter
	 */
	spanStarted(span: Span) {
		// Not implemented
	}

	/**
	 * Span is finished.
	 *
	 * @param {Span} span
	 * @memberof BaseTraceExporter
	 */
	spanFinished(span: Span) {
		// Not implemented
	}

	/**
	 * Flattening tags to one-level object.
	 * E.g.
	 *  **From:**
	 * 	```js
	 * 	{
	 * 		error: {
	 * 			name: "MoleculerError"
	 * 		}
	 * 	}
	 *  ```
	 *
	 * 	**To:**
	 * 	```js
	 *  {
	 * 		"error.name": "MoleculerError"
	 *  }
	 *  ```
	 *
	 * @param {Record<string, any>} obj
	 * @param {boolean} [convertToString=false]
	 * @param {string} [path=""]
	 * @returns {Record<string, any>}
	 * @memberof BaseTraceExporter
	 */
	flattenTags(obj, convertToString = false, path = "") {
		if (!obj) return null;

		if (this.opts.safetyTags) {
			obj = safetyObject(obj);
		}

		return Object.keys(obj).reduce((res, k) => {
			const o = obj[k];
			const pp = (path ? path + "." : "") + k;

			if (isObject(o)) Object.assign(res, this.flattenTags(o, convertToString, pp));
			else if (o !== undefined) {
				res[pp] = convertToString ? String(o) : o;
			}

			return res;
		}, {});
	}

	/**
	 * Convert Error to POJO.
	 *
	 * @param {Error|boolean} err
	 * @returns {Record<string, any>}
	 * @memberof BaseTraceExporter
	 */
	errorToObject(err: Error | boolean): Record<string, any> {
		if (!err || !isObject(err)) return null;

		return _.pick(err, this.tracer.opts.errorFields);
	}
}

export = BaseTraceExporter;
