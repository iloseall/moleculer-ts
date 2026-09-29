/*
 * moleculer
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

export const TYPE_COUNTER = "counter";
export const TYPE_GAUGE = "gauge";
export const TYPE_HISTOGRAM = "histogram";
export const TYPE_INFO = "info";
export const PROCESS_ARGUMENTS = "process.arguments";
export const PROCESS_PID = "process.pid";
export const PROCESS_PPID = "process.ppid";
export const PROCESS_MEMORY_HEAP_SIZE_TOTAL = "process.memory.heap.size.total";
export const PROCESS_MEMORY_HEAP_SIZE_USED = "process.memory.heap.size.used";
export const PROCESS_MEMORY_RSS = "process.memory.rss";
export const PROCESS_MEMORY_EXTERNAL = "process.memory.external";
export const PROCESS_MEMORY_HEAP_SPACE_SIZE_TOTAL = "process.memory.heap.space.size.total";
export const PROCESS_MEMORY_HEAP_SPACE_SIZE_USED = "process.memory.heap.space.size.used";
export const PROCESS_MEMORY_HEAP_SPACE_SIZE_AVAILABLE = "process.memory.heap.space.size.available";
export const PROCESS_MEMORY_HEAP_SPACE_SIZE_PHYSICAL = "process.memory.heap.space.size.physical";
export const PROCESS_MEMORY_HEAP_STAT_HEAP_SIZE_TOTAL = "process.memory.heap.stat.heap.size.total";
export const PROCESS_MEMORY_HEAP_STAT_EXECUTABLE_SIZE_TOTAL =
	"process.memory.heap.stat.executable.size.total";
export const PROCESS_MEMORY_HEAP_STAT_PHYSICAL_SIZE_TOTAL =
	"process.memory.heap.stat.physical.size.total";
export const PROCESS_MEMORY_HEAP_STAT_AVAILABLE_SIZE_TOTAL =
	"process.memory.heap.stat.available.size.total";
export const PROCESS_MEMORY_HEAP_STAT_USED_HEAP_SIZE = "process.memory.heap.stat.used.heap.size";
export const PROCESS_MEMORY_HEAP_STAT_HEAP_SIZE_LIMIT = "process.memory.heap.stat.heap.size.limit";
export const PROCESS_MEMORY_HEAP_STAT_MALLOCATED_MEMORY =
	"process.memory.heap.stat.mallocated.memory";
export const PROCESS_MEMORY_HEAP_STAT_PEAK_MALLOCATED_MEMORY =
	"process.memory.heap.stat.peak.mallocated.memory";
export const PROCESS_MEMORY_HEAP_STAT_ZAP_GARBAGE = "process.memory.heap.stat.zap.garbage";
export const PROCESS_UPTIME = "process.uptime";
export const PROCESS_INTERNAL_ACTIVE_HANDLES = "process.internal.active.handles";
export const PROCESS_VERSIONS_NODE = "process.versions.node";
export const OS_MEMORY_FREE = "os.memory.free";
export const OS_MEMORY_USED = "os.memory.used";
export const OS_MEMORY_TOTAL = "os.memory.total";
export const OS_UPTIME = "os.uptime";
export const OS_TYPE = "os.type";
export const OS_RELEASE = "os.release";
export const OS_HOSTNAME = "os.hostname";
export const OS_ARCH = "os.arch";
export const OS_PLATFORM = "os.platform";
export const OS_USER_UID = "os.user.uid";
export const OS_USER_GID = "os.user.gid";
export const OS_USER_USERNAME = "os.user.username";
export const OS_USER_HOMEDIR = "os.user.homedir";
export const OS_DATETIME_UNIX = "os.datetime.unix";
export const OS_DATETIME_ISO = "os.datetime.iso";
export const OS_DATETIME_UTC = "os.datetime.utc";
export const OS_DATETIME_TZ_OFFSET = "os.datetime.tz.offset";
export const OS_NETWORK_ADDRESS = "os.network.address";
export const OS_NETWORK_MAC = "os.network.mac";
export const OS_CPU_LOAD_1 = "os.cpu.load.1";
export const OS_CPU_LOAD_5 = "os.cpu.load.5";
export const OS_CPU_LOAD_15 = "os.cpu.load.15";
export const OS_CPU_UTILIZATION = "os.cpu.utilization";
export const OS_CPU_USER = "os.cpu.user";
export const OS_CPU_SYSTEM = "os.cpu.system";
export const OS_CPU_TOTAL = "os.cpu.total";
export const OS_CPU_INFO_MODEL = "os.cpu.info.model";
export const OS_CPU_INFO_SPEED = "os.cpu.info.speed";
export const OS_CPU_INFO_TIMES_USER = "os.cpu.info.times.user";
export const OS_CPU_INFO_TIMES_SYS = "os.cpu.info.times.sys";
export const MOLECULER_NODE_TYPE = "moleculer.node.type";
export const MOLECULER_NODE_VERSIONS_MOLECULER = "moleculer.node.versions.moleculer";
export const MOLECULER_NODE_VERSIONS_LANG = "moleculer.node.versions.lang";
export const MOLECULER_NODE_VERSIONS_PROTOCOL = "moleculer.node.versions.protocol";
export const MOLECULER_BROKER_NAMESPACE = "moleculer.broker.namespace";
export const MOLECULER_BROKER_STARTED = "moleculer.broker.started";
export const MOLECULER_BROKER_LOCAL_SERVICES_TOTAL = "moleculer.broker.local.services.total";
export const MOLECULER_BROKER_MIDDLEWARES_TOTAL = "moleculer.broker.middlewares.total";
export const MOLECULER_REGISTRY_NODES_TOTAL = "moleculer.registry.nodes.total";
export const MOLECULER_REGISTRY_NODES_ONLINE_TOTAL = "moleculer.registry.nodes.online.total";
export const MOLECULER_REGISTRY_SERVICES_TOTAL = "moleculer.registry.services.total";
export const MOLECULER_REGISTRY_SERVICE_ENDPOINTS_TOTAL =
	"moleculer.registry.service.endpoints.total";
export const MOLECULER_REGISTRY_ACTIONS_TOTAL = "moleculer.registry.actions.total";
export const MOLECULER_REGISTRY_ACTION_ENDPOINTS_TOTAL =
	"moleculer.registry.action.endpoints.total";
export const MOLECULER_REGISTRY_EVENTS_TOTAL = "moleculer.registry.events.total";
export const MOLECULER_REGISTRY_EVENT_ENDPOINTS_TOTAL = "moleculer.registry.event.endpoints.total";
export const MOLECULER_REQUEST_TOTAL = "moleculer.request.total";
export const MOLECULER_REQUEST_ACTIVE = "moleculer.request.active";
export const MOLECULER_REQUEST_ERROR_TOTAL = "moleculer.request.error.total";
export const MOLECULER_REQUEST_TIME = "moleculer.request.time";
export const MOLECULER_REQUEST_LEVELS = "moleculer.request.levels";
export const MOLECULER_EVENT_EMIT_TOTAL = "moleculer.event.emit.total";
export const MOLECULER_EVENT_BROADCAST_TOTAL = "moleculer.event.broadcast.total";
export const MOLECULER_EVENT_BROADCASTLOCAL_TOTAL = "moleculer.event.broadcast-local.total";
export const MOLECULER_EVENT_RECEIVED_TOTAL = "moleculer.event.received.total";
export const MOLECULER_EVENT_RECEIVED_ACTIVE = "moleculer.event.received.active";
export const MOLECULER_EVENT_RECEIVED_ERROR_TOTAL = "moleculer.event.received.error.total";
export const MOLECULER_EVENT_RECEIVED_TIME = "moleculer.event.received.time";
export const MOLECULER_TRANSIT_PUBLISH_TOTAL = "moleculer.transit.publish.total";
export const MOLECULER_TRANSIT_RECEIVE_TOTAL = "moleculer.transit.receive.total";
export const MOLECULER_TRANSIT_REQUESTS_ACTIVE = "moleculer.transit.requests.active";
export const MOLECULER_TRANSIT_STREAMS_SEND_ACTIVE = "moleculer.transit.streams.send.active";
export const MOLECULER_TRANSIT_READY = "moleculer.transit.ready";
export const MOLECULER_TRANSIT_CONNECTED = "moleculer.transit.connected";
export const MOLECULER_TRANSIT_PONG_TIME = "moleculer.transit.pong.time";
export const MOLECULER_TRANSIT_PONG_SYSTIME_DIFF = "moleculer.transit.pong.systime-diff";
export const MOLECULER_TRANSIT_ORPHAN_RESPONSE_TOTAL = "moleculer.transit.orphan.response.total";
export const MOLECULER_TRANSPORTER_PACKETS_SENT_TOTAL = "moleculer.transporter.packets.sent.total";
export const MOLECULER_TRANSPORTER_PACKETS_SENT_BYTES = "moleculer.transporter.packets.sent.bytes";
export const MOLECULER_TRANSPORTER_PACKETS_RECEIVED_TOTAL =
	"moleculer.transporter.packets.received.total";
export const MOLECULER_TRANSPORTER_PACKETS_RECEIVED_BYTES =
	"moleculer.transporter.packets.received.bytes";
export const MOLECULER_CIRCUIT_BREAKER_OPENED_ACTIVE = "moleculer.circuit-breaker.opened.active";
export const MOLECULER_CIRCUIT_BREAKER_OPENED_TOTAL = "moleculer.circuit-breaker.opened.total";
export const MOLECULER_CIRCUIT_BREAKER_HALF_OPENED_ACTIVE =
	"moleculer.circuit-breaker.half-opened.active";
export const MOLECULER_REQUEST_FALLBACK_TOTAL = "moleculer.request.fallback.total";
export const MOLECULER_REQUEST_BULKHEAD_INFLIGHT = "moleculer.request.bulkhead.inflight";
export const MOLECULER_REQUEST_BULKHEAD_QUEUE_SIZE = "moleculer.request.bulkhead.queue.size";
export const MOLECULER_EVENT_BULKHEAD_INFLIGHT = "moleculer.event.bulkhead.inflight";
export const MOLECULER_EVENT_BULKHEAD_QUEUE_SIZE = "moleculer.event.bulkhead.queue.size";
export const MOLECULER_REQUEST_RETRY_ATTEMPTS_TOTAL = "moleculer.request.retry.attempts.total";
export const MOLECULER_REQUEST_TIMEOUT_TOTAL = "moleculer.request.timeout.total";
export const MOLECULER_CACHER_GET_TOTAL = "moleculer.cacher.get.total";
export const MOLECULER_CACHER_GET_TIME = "moleculer.cacher.get.time";
export const MOLECULER_CACHER_FOUND_TOTAL = "moleculer.cacher.found.total";
export const MOLECULER_CACHER_SET_TOTAL = "moleculer.cacher.set.total";
export const MOLECULER_CACHER_SET_TIME = "moleculer.cacher.set.time";
export const MOLECULER_CACHER_DEL_TOTAL = "moleculer.cacher.del.total";
export const MOLECULER_CACHER_DEL_TIME = "moleculer.cacher.del.time";
export const MOLECULER_CACHER_CLEAN_TOTAL = "moleculer.cacher.clean.total";
export const MOLECULER_CACHER_CLEAN_TIME = "moleculer.cacher.clean.time";
export const MOLECULER_CACHER_EXPIRED_TOTAL = "moleculer.cacher.expired.total";
export const MOLECULER_DISCOVERER_REDIS_COLLECT_TOTAL = "moleculer.discoverer.redis.collect.total";
export const MOLECULER_DISCOVERER_REDIS_COLLECT_TIME = "moleculer.discoverer.redis.collect.time";
export const MOLECULER_DISCOVERER_ETCD_COLLECT_TOTAL = "moleculer.discoverer.etcd.collect.total";
export const MOLECULER_DISCOVERER_ETCD_COLLECT_TIME = "moleculer.discoverer.etcd.collect.time";
export const UNIT_BIT = "bit";
export const UNIT_BYTE = "byte";
export const UNIT_KILOBYTES = "kilobyte";
export const UNIT_MEGABYTE = "megabyte";
export const UNIT_GIGABYTE = "gigabyte";
export const UNIT_TERRABYTE = "terrabyte";
export const UNIT_PETABYTE = "petabyte";
export const UNIT_EXOBYTE = "exabyte";
export const UNIT_NANOSECONDS = "nanosecond";
export const UNIT_MICROSECONDS = "microsecond";
export const UNIT_MILLISECONDS = "millisecond";
export const UNIT_SECONDS = "second";
export const UNIT_MINUTE = "minute";
export const UNIT_HOUR = "hour";
export const UNIT_DAY = "day";
export const UNIT_WEEK = "week";
export const UNIT_MONTH = "month";
export const UNIT_YEAR = "year";
export const UNIT_HANDLE = "handle";
export const UNIT_CPU = "cpu";
export const UNIT_GHZ = "GHz";
export const UNIT_REQUEST = "request";
export const UNIT_CONNECTION = "connection";
export const UNIT_PACKET = "packet";
export const UNIT_MESSAGE = "message";
export const UNIT_STREAM = "stream";
export const UNIT_EVENT = "event";
