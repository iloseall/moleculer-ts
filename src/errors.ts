/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type ServiceBroker from "./service-broker";

/**
 * Extendable errors class.
 *
 * Credits: https://github.com/bjyoungblood/es6-error/blob/master/src/index.js
 */
export class ExtendableError extends Error {
	message: string;
	name: string;
	stack?: string;

	constructor(message = "") {
		super(message);

		// extending Error is weird and does not propagate `message`
		Object.defineProperty(this, "message", {
			configurable: true,
			enumerable: false,
			value: message,
			writable: true
		});

		Object.defineProperty(this, "name", {
			configurable: true,
			enumerable: false,
			value: this.constructor.name,
			writable: true
		});

		if (Object.prototype.hasOwnProperty.call(Error, "captureStackTrace")) {
			Error.captureStackTrace(this, this.constructor);
			return;
		}

		Object.defineProperty(this, "stack", {
			configurable: true,
			enumerable: false,
			value: new Error(message).stack,
			writable: true
		});
	}
}

export class TimeoutError extends ExtendableError {}

/**
 * Custom Moleculer Error class
 *
 * @class MoleculerError
 * @extends {ExtendableError}
 */
export class MoleculerError extends ExtendableError {
	code: number;
	type: string;
	data: any;
	retryable: boolean;

	constructor(message?: string, code?: number, type?: string, data?: any) {
		super(message);
		this.code = code || 500;
		this.type = type;
		this.data = data;
		this.retryable = false;
	}
}

/**
 * Custom Moleculer Error class for retryable errors.
 *
 * @class MoleculerRetryableError
 * @extends {MoleculerError}
 */
export class MoleculerRetryableError extends MoleculerError {
	constructor(message?: string, code?: number, type?: string, data?: any) {
		super(message);
		this.code = code || 500;
		this.type = type;
		this.data = data;
		this.retryable = true;
	}
}

/**
 * Moleculer Error class for Broker disconnections which are retryable.
 *
 * @class MoleculerServerError
 * @extends {MoleculerRetryableError}
 */
export class BrokerDisconnectedError extends MoleculerRetryableError {
	constructor(message?: string) {
		super(
			message ||
				"The broker's transporter has disconnected. Please try again when a connection is reestablished.",
			502,
			"BAD_GATEWAY"
		);
		// Stack trace is hidden because it creates a lot of logs and, in this case, won't help users find the issue
		this.stack = "";
	}
}

/**
 * Moleculer Error class for server errors which are retryable.
 *
 * @class MoleculerServerError
 * @extends {MoleculerRetryableError}
 */
export class MoleculerServerError extends MoleculerRetryableError {}

/**
 * Moleculer Error class for client errors which are not retryable.
 *
 * @class MoleculerClientError
 * @extends {MoleculerError}
 */
export class MoleculerClientError extends MoleculerError {
	constructor(message?: string, code?: number, type?: string, data?: any) {
		super(message, code || 400, type, data);
	}
}

/**
 * 'Service not found' Error message
 *
 * @class ServiceNotFoundError
 * @extends {MoleculerRetryableError}
 */
export class ServiceNotFoundError extends MoleculerRetryableError {
	constructor(data: Record<string, any> = {}) {
		let msg;
		if (data.nodeID && data.action)
			msg = `Service '${data.action}' is not found on '${data.nodeID}' node.`;
		else if (data.action) msg = `Service '${data.action}' is not found.`;

		if (data.service && data.version)
			msg = `Service '${data.version}.${data.service}' not found.`;
		else if (data.service) msg = `Service '${data.service}' not found.`;

		super(msg, 404, "SERVICE_NOT_FOUND", data);
	}
}

/**
 * 'Service not available' Error message
 *
 * @class ServiceNotAvailableError
 * @extends {MoleculerRetryableError}
 */
export class ServiceNotAvailableError extends MoleculerRetryableError {
	constructor(data: Record<string, any>) {
		let msg;
		if (data.nodeID)
			msg = `Service '${data.action}' is not available on '${data.nodeID}' node.`;
		else msg = `Service '${data.action}' is not available.`;

		super(msg, 404, "SERVICE_NOT_AVAILABLE", data);
	}
}

/**
 * 'Request timed out' Error message. Retryable.
 *
 * @class RequestTimeoutError
 * @extends {MoleculerRetryableError}
 */
export class RequestTimeoutError extends MoleculerRetryableError {
	constructor(data: Record<string, any>) {
		super(
			`Request is timed out when call '${data.action}' action on '${data.nodeID}' node.`,
			504,
			"REQUEST_TIMEOUT",
			data
		);
	}
}

/**
 * 'Request skipped for timeout' Error message
 *
 * @class RequestSkippedError
 * @extends {MoleculerError}
 */
export class RequestSkippedError extends MoleculerError {
	constructor(data: Record<string, any>) {
		super(
			`Calling '${data.action}' is skipped because timeout reached on '${data.nodeID}' node.`,
			514,
			"REQUEST_SKIPPED",
			data
		);
		this.retryable = false;
	}
}

/**
 * 'Request rejected' Error message. Retryable.
 *
 * @class RequestRejectedError
 * @extends {MoleculerRetryableError}
 */
export class RequestRejectedError extends MoleculerRetryableError {
	constructor(data: Record<string, any>) {
		super(
			`Request is rejected when call '${data.action}' action on '${data.nodeID}' node.`,
			503,
			"REQUEST_REJECTED",
			data
		);
	}
}

/**
 * 'Queue is full' error message. Retryable.
 *
 * @class QueueIsFullError
 * @extends {MoleculerRetryableError}
 */
export class QueueIsFullError extends MoleculerRetryableError {
	constructor(data: Record<string, any>) {
		super(
			`Queue is full. Request '${data.action}' action on '${data.nodeID}' node is rejected.`,
			429,
			"QUEUE_FULL",
			data
		);
	}
}

/**
 * 'Parameters of action call validation error
 *
 * @class ValidationError
 * @extends {MoleculerClientError}
 */
export class ValidationError extends MoleculerClientError {
	constructor(message: string, type?: string, data?: any) {
		super(message, 422, type || "VALIDATION_ERROR", data);
	}
}

/**
 * 'Max request call level!' Error message
 *
 * @class MaxCallLevelError
 * @extends {MoleculerError}
 */
export class MaxCallLevelError extends MoleculerError {
	constructor(data: Record<string, any>) {
		super(
			`Request level is reached the limit (${data.level}) on '${data.nodeID}' node.`,
			500,
			"MAX_CALL_LEVEL",
			data
		);
		this.retryable = false;
	}
}

/**
 * Custom Moleculer Error class for Service schema errors
 *
 * @class ServiceSchemaError
 * @extends {MoleculerError}
 */
export class ServiceSchemaError extends MoleculerError {
	constructor(msg: string, data?: any) {
		super(msg, 500, "SERVICE_SCHEMA_ERROR", data);
	}
}

/**
 * Custom Moleculer Error class for broker option errors
 *
 * @class BrokerOptionsError
 * @extends {MoleculerError}
 */
export class BrokerOptionsError extends MoleculerError {
	constructor(msg: string, data?: any) {
		super(msg, 500, "BROKER_OPTIONS_ERROR", data);
	}
}

/**
 * Custom Moleculer Error class for Graceful stopping
 *
 * @class GracefulStopTimeoutError
 * @extends {MoleculerError}
 */
export class GracefulStopTimeoutError extends MoleculerError {
	constructor(data?: Record<string, any>) {
		if (data && data.service) {
			super(
				`Unable to stop '${data.service.name}' service gracefully.`,
				500,
				"GRACEFUL_STOP_TIMEOUT",
				data && data.service
					? {
							name: data.service.name,
							version: data.service.version
						}
					: null
			);
		} else {
			super("Unable to stop ServiceBroker gracefully.", 500, "GRACEFUL_STOP_TIMEOUT");
		}
	}
}

/**
 * Protocol version is mismatch
 *
 * @class ProtocolVersionMismatchError
 * @extends {MoleculerError}
 */
export class ProtocolVersionMismatchError extends MoleculerError {
	constructor(data?: Record<string, any>) {
		super("Protocol version mismatch.", 500, "PROTOCOL_VERSION_MISMATCH", data);
	}
}

/**
 * Invalid packet format error
 *
 * @class InvalidPacketDataError
 * @extends {MoleculerError}
 */
export class InvalidPacketDataError extends MoleculerError {
	constructor(data?: Record<string, any>) {
		super("Invalid packet data.", 500, "INVALID_PACKET_DATA", data);
	}
}

export interface PlainMoleculerError extends MoleculerError {
	nodeID?: string;
}

/** Error classes which can be recreated from a transferred payload. */
const recreatableClasses: Record<string, any> = {
	MoleculerError,
	MoleculerRetryableError,
	MoleculerServerError,
	MoleculerClientError,

	ValidationError,

	ServiceNotFoundError,
	ServiceNotAvailableError,
	RequestTimeoutError,
	RequestSkippedError,
	RequestRejectedError,
	QueueIsFullError,
	MaxCallLevelError,
	GracefulStopTimeoutError,
	ProtocolVersionMismatchError,
	InvalidPacketDataError,

	ServiceSchemaError,
	BrokerOptionsError
};

/**
 * Recreate an error from a transferred payload `err`
 *
 * @param {MoleculerError} err
 * @returns {MoleculerError}
 */
export function recreateError(err: Record<string, any>) {
	const Class = recreatableClasses[err.name];
	if (Class) {
		switch (err.name) {
			case "MoleculerError":
				return new Class(err.message, err.code, err.type, err.data);
			case "MoleculerRetryableError":
				return new Class(err.message, err.code, err.type, err.data);
			case "MoleculerServerError":
				return new Class(err.message, err.code, err.type, err.data);
			case "MoleculerClientError":
				return new Class(err.message, err.code, err.type, err.data);

			case "ValidationError":
				return new Class(err.message, err.type, err.data);

			case "ServiceNotFoundError":
				return new Class(err.data);
			case "ServiceNotAvailableError":
				return new Class(err.data);
			case "RequestTimeoutError":
				return new Class(err.data);
			case "RequestSkippedError":
				return new Class(err.data);
			case "RequestRejectedError":
				return new Class(err.data);
			case "QueueIsFullError":
				return new Class(err.data);
			case "MaxCallLevelError":
				return new Class(err.data);
			case "GracefulStopTimeoutError":
				return new Class(err.data);
			case "ProtocolVersionMismatchError":
				return new Class(err.data);
			case "InvalidPacketDataError":
				return new Class(err.data);

			case "ServiceSchemaError":
			case "BrokerOptionsError":
				return new Class(err.message, err.data);
		}
	}
}

/**
 * Error Regenerator
 * @class Regenerator
 */
export class Regenerator {
	broker: ServiceBroker;

	/**
	 * Initializes Regenerator
	 *
	 * @param {ServiceBroker} broker
	 *
	 * @memberof Regenerator
	 */
	init(broker: ServiceBroker): void {
		this.broker = broker;
	}

	/**
	 * Restores an Error object
	 *
	 * @param {PlainMoleculerError} plainError
	 * @param {Record<string, any>} payload
	 * @return {Error}
	 *
	 * @memberof Regenerator
	 */
	restore(plainError: PlainMoleculerError, payload: Record<string, any>): Error {
		let err: Error = this.restoreCustomError(plainError, payload);
		if (!err) {
			err = recreateError(plainError);
		}
		if (!err) {
			err = this._createDefaultError(plainError);
		}
		this._restoreExternalFields(plainError, err as PlainMoleculerError, payload);
		this._restoreStack(plainError, err);

		return err;
	}

	/**
	 * Extracts a plain error object from Error object
	 *
	 * @param {Record<string, any>} plainErr
	 * @param {Record<string, any>} payload
	 * @return {PlainMoleculerError} plain error
	 *
	 * @memberof Regenerator
	 */
	extractPlainError(
		plainErr: Record<string, any>,
		payload?: Record<string, any>
	): PlainMoleculerError {
		return {
			name: plainErr.name,
			message: plainErr.message,
			nodeID: plainErr.nodeID || this.broker.nodeID,
			code: plainErr.code,
			type: plainErr.type,
			retryable: plainErr.retryable,
			stack: plainErr.stack,
			data: plainErr.data
		};
	}

	/**
	 * Hook to restore a custom error in a child class
	 *
	 * @param {PlainMoleculerError} plainError
	 * @param {Object} payload
	 * @return {MoleculerError}
	 *
	 * @memberof Regenerator
	 */
	restoreCustomError(plainError?: PlainMoleculerError, payload?: Record<string, any>): Error {
		return undefined;
	}

	/**
	 * Creates a default error if not found
	 *
	 * @param {PlainMoleculerError} plainError
	 * @return {any}
	 * @private
	 *
	 * @memberof Regenerator
	 */
	_createDefaultError(plainError: PlainMoleculerError): Error {
		const err: any = new Error(plainError.message);
		err.name = plainError.name;
		err.code = plainError.code;
		err.type = plainError.type;
		err.data = plainError.data;
		if (plainError.stack) err.stack = plainError.stack;

		return err;
	}

	/**
	 * Restores external error fields
	 *
	 * @param {PlainMoleculerError} plainError
	 * @param {PlainMoleculerError} err
	 * @param {Object} payload
	 * @private
	 *
	 * @memberof Regenerator
	 */
	_restoreExternalFields(
		plainError: PlainMoleculerError,
		err: PlainMoleculerError,
		payload: Record<string, any>
	): void {
		err.retryable = plainError.retryable;
		err.nodeID = plainError.nodeID || payload.sender;
	}

	/**
	 * Restores an error stack
	 *
	 * @param {PlainMoleculerError} plainError
	 * @param {Error} err
	 * @private
	 *
	 * @memberof Regenerator
	 */
	_restoreStack(plainError: PlainMoleculerError, err: Error): void {
		if (plainError.stack) err.stack = plainError.stack;
	}
}

/**
 * Resolves a regenerator option
 *
 * @param {Regenerator=} opt
 * @return {Regenerator}
 */
export function resolveRegenerator(opt?: Regenerator): Regenerator {
	if (opt instanceof Regenerator) {
		return opt;
	}

	return new Regenerator();
}
