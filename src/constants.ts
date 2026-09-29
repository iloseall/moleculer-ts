/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

// Circuit-breaker states
export const CIRCUIT_CLOSE = "close";
export const CIRCUIT_HALF_OPEN = "half_open";
export const CIRCUIT_HALF_OPEN_WAIT = "half_open_wait";
export const CIRCUIT_OPEN = "open";

// Error list in core modules

/** Emitted when transit fails to process the packet */
export const FAILED_PROCESSING_PACKET = "failedProcessingPacket";
/** Emitted when transit fails to send request packet */
export const FAILED_SEND_REQUEST_PACKET = "failedSendRequestPacket";
/** Emitted when transit fails to send event packet */
export const FAILED_SEND_EVENT_PACKET = "failedSendEventPacket";
/** Emitted when transit fails to send response packet */
export const FAILED_SEND_RESPONSE_PACKET = "failedSendResponsePacket";
/** Emitted when transit fails to discover multiple nodes */
export const FAILED_NODES_DISCOVERY = "failedNodesDiscovery";
/** Emitted when transit fails to discover a single nodes */
export const FAILED_NODE_DISCOVERY = "failedNodeDiscovery";
/** Emitted when transit fails to send an INFO packet */
export const FAILED_SEND_INFO_PACKET = "failedSendInfoPacket";
/** Emitted when transit fails to send a PING packet */
export const FAILED_SEND_PING_PACKET = "failedSendPingPacket";
/** Emitted when transit fails to send a PONG packet */
export const FAILED_SEND_PONG_PACKET = "failedSendPongPacket";
/** Emitted when transit fails to send a HEARTBEAT packet */
export const FAILED_SEND_HEARTBEAT_PACKET = "failedSendHeartbeatPacket";
/** Emitted when broker fails to stop all services */
export const FAILED_STOPPING_SERVICES = "failedServicesStop";
/** Emitted when broker fails to stop all services */
export const FAILED_LOAD_SERVICE = "failedServiceLoad";
/** Emitted when broker fails to stop all services */
export const FAILED_RESTART_SERVICE = "failedServiceRestart";
/** Emitted when broker fails to stop all services */
export const FAILED_DESTRUCTION_SERVICE = "failedServiceDestruction";
/** Emitted when CACHER/DISCOVERER/TRANSPORTER client receives an error */
export const CLIENT_ERROR = "clientError";
/** Emitted when Redis client fails during while pinging the server */
export const FAILED_SEND_PING = "failedSendPing";
/** Emitted when etcd3 discoverer fails to collect the keys */
export const FAILED_COLLECT_KEYS = "failedCollectKeys";
/** Emitted when etcd3 discoverer fails to send INFO packet */
export const FAILED_SEND_INFO = "failedSendInfo";
/** Emitted when Redis discoverer fails to scan the keys */
export const FAILED_KEY_SCAN = "failedKeyScan";
/** Emitted when Redis publisher fails for some reason */
export const FAILED_PUBLISHER_ERROR = "publisherError";
/** Emitted when Redis consumer fails for some reason */
export const FAILED_CONSUMER_ERROR = "consumerError";
/** Emitted when Kafka fails to create topics */
export const FAILED_TOPIC_CREATION = "failedTopicCreation";
/** Emitted when AMQP fails to connect */
export const FAILED_CONNECTION_ERROR = "failedConnection";
/** Emitted when AMQP fails to connect */
export const FAILED_CHANNEL_ERROR = "failedChannel";
/** Emitted when AMQP fails ACK packet */
export const FAILED_REQUEST_ACK = "requestAck";
/** Emitted when AMQP fails for some reason and disconnects */
export const FAILED_DISCONNECTION = "failedDisconnection";
/** Emitted when AMQP fails to publish balanced event */
export const FAILED_PUBLISH_BALANCED_EVENT = "failedPublishBalancedEvent";
/** Emitted when AMQP fails to publish balanced request */
export const FAILED_PUBLISH_BALANCED_REQUEST = "publishBalancedRequest";
