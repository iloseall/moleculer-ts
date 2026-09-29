/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import type { NodeRawInfo } from "./registry";

/**
 * Node class
 *
 * @class Node
 */
class Node {
	id: string;
	instanceID: string | null;
	available: boolean;
	local: boolean;
	lastHeartbeatTime: number;
	config: Record<string, any>;
	client: Record<string, any>;
	metadata: Record<string, any> | null;
	ipList: string[] | null;
	port: number | null;
	hostname: string | null;
	udpAddress: string | null;
	rawInfo: NodeRawInfo | null;
	services: Record<string, any>[];
	cpu: number | null;
	cpuSeq: number | null;
	seq: number;
	offlineSince: number | null;
	/**
	 * Creates an instance of Node.
	 *
	 * @param {String} id
	 *
	 * @memberof Node
	 */
	constructor(id: string) {
		this.id = id;
		this.instanceID = null;
		this.available = true;
		this.local = false;
		this.lastHeartbeatTime = Math.round(process.uptime());
		this.config = {};
		this.client = {};
		this.metadata = null;

		this.ipList = null;
		this.port = null;
		this.hostname = null;
		this.udpAddress = null;

		this.rawInfo = null;
		this.services = [];

		this.cpu = null;
		this.cpuSeq = null;

		this.seq = 0;
		this.offlineSince = null;
	}

	/**
	 * Update properties
	 *
	 * @param {NodeRawInfo} payload
	 * @param {boolean} isReconnected
	 * @memberof Node
	 */
	update(payload: NodeRawInfo, isReconnected: boolean): boolean {
		// Update properties
		this.metadata = payload.metadata;
		this.ipList = payload.ipList;
		this.hostname = payload.hostname;
		this.port = payload.port;
		this.client = payload.client || {};
		this.config = payload.config || {};

		this.services = payload.services;
		this.rawInfo = payload;

		const newSeq = payload.seq || 1;
		if (newSeq > this.seq || isReconnected || payload.instanceID !== this.instanceID) {
			this.instanceID = payload.instanceID;
			this.seq = newSeq;
			return true;
		}
	}

	/**
	 * Update local properties.
	 *
	 * @param {Function} cpuUsage
	 * @memberof Node
	 */
	updateLocalInfo(cpuUsage: Function): Promise<any> {
		return cpuUsage()
			.then(res => {
				const newVal = Math.round(res.avg);
				if (this.cpu != newVal) {
					this.cpu = newVal;
					this.cpuSeq++;
				}
			})
			.catch(() => {
				/* silent */
			});
	}

	/**
	 * Update heartbeat properties
	 *
	 * @param {object} payload
	 * @memberof Node
	 */
	heartbeat(payload) {
		if (!this.available) {
			this.available = true;
			this.offlineSince = null;
		}

		if (payload.cpu != null) {
			this.cpu = payload.cpu;
			this.cpuSeq = payload.cpuSeq || 1;
		}

		this.lastHeartbeatTime = Math.round(process.uptime());
	}

	/**
	 * Node disconnected
	 *
	 * @memberof Node
	 */
	disconnected(isUnexpected?: boolean) {
		if (this.available) {
			this.offlineSince = Math.round(process.uptime());
			this.seq++;
		}

		this.available = false;
	}
}

export = Node;
