/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

import * as P from "../../packets";

export const PACKET_EVENT_ID = 1;
export const PACKET_REQUEST_ID = 2;
export const PACKET_RESPONSE_ID = 3;
export const PACKET_PING_ID = 4;
export const PACKET_PONG_ID = 5;
export const PACKET_GOSSIP_REQ_ID = 6;
export const PACKET_GOSSIP_RES_ID = 7;
export const PACKET_GOSSIP_HELLO_ID = 8;

export const IGNORABLE_ERRORS = [
	"ECONNREFUSED",
	"ECONNRESET",
	"ETIMEDOUT",
	"EHOSTUNREACH",
	"ENETUNREACH",
	"ENETDOWN",
	"EPIPE",
	"ENOENT"
];

export function resolvePacketID(type: string): number {
	/* istanbul ignore next */
	switch (type) {
		case P.PACKET_EVENT:
			return PACKET_EVENT_ID;
		case P.PACKET_REQUEST:
			return PACKET_REQUEST_ID;
		case P.PACKET_RESPONSE:
			return PACKET_RESPONSE_ID;
		case P.PACKET_PING:
			return PACKET_PING_ID;
		case P.PACKET_PONG:
			return PACKET_PONG_ID;
		case P.PACKET_GOSSIP_REQ:
			return PACKET_GOSSIP_REQ_ID;
		case P.PACKET_GOSSIP_RES:
			return PACKET_GOSSIP_RES_ID;
		case P.PACKET_GOSSIP_HELLO:
			return PACKET_GOSSIP_HELLO_ID;
		default:
			throw new Error("Unsupported packet type (" + type + ")!");
	}
}

export function resolvePacketType(
	id: number
): "EVENT" | "REQ" | "RES" | "PING" | "PONG" | "GOSSIP_REQ" | "GOSSIP_RES" | "GOSSIP_HELLO" {
	/* istanbul ignore next */
	switch (id) {
		case PACKET_EVENT_ID:
			return P.PACKET_EVENT;
		case PACKET_REQUEST_ID:
			return P.PACKET_REQUEST;
		case PACKET_RESPONSE_ID:
			return P.PACKET_RESPONSE;
		case PACKET_PING_ID:
			return P.PACKET_PING;
		case PACKET_PONG_ID:
			return P.PACKET_PONG;
		case PACKET_GOSSIP_REQ_ID:
			return P.PACKET_GOSSIP_REQ;
		case PACKET_GOSSIP_RES_ID:
			return P.PACKET_GOSSIP_RES;
		case PACKET_GOSSIP_HELLO_ID:
			return P.PACKET_GOSSIP_HELLO;
		default:
			throw new Error("Unsupported packet ID (" + id + ")!");
	}
}
