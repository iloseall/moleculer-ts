import { describe, it, before, after, mock } from "../../helpers/test";
import expect from "../../helpers/expect";
import { interopDefault } from "../../helpers/module-mock";

import lolex from "@sinonjs/fake-timers";
import ServiceBroker from "../../../src/service-broker";
import MemoryLRUCacher from "../../../src/cachers/memory-lru";

describe("Test MemoryLRUCacher constructor", () => {
	it("should create an empty options", () => {
		const cacher = new MemoryLRUCacher();
		expect(cacher).toBeDefined();
		expect(cacher.opts).toBeDefined();
		expect(cacher.opts.ttl).toBeNull();
		expect(cacher.connected).toBe(null);
	});

	it("should create a timer if set ttl option", () => {
		const opts = { ttl: 500 };
		const cacher = new MemoryLRUCacher(opts);
		expect(cacher).toBeDefined();
		expect(cacher.opts).toEqual(opts);
		expect(cacher.opts.ttl).toBe(500);
		expect(cacher.cache).toBeDefined();
		expect(cacher.timer).toBeDefined();
	});
});

describe("Test MemoryLRUCacher init", () => {
	it("check init", () => {
		const broker = new ServiceBroker({ logger: false });
		broker.localBus.on = mock.fn();
		const cacher = new MemoryLRUCacher();

		expect(cacher.connected).toBe(null);

		cacher.init(broker);

		expect(cacher.connected).toBe(true);

		expect(broker.localBus.on).toHaveBeenCalledTimes(1);
		expect(broker.localBus.on).toHaveBeenCalledWith(
			"$transporter.connected",
			expect.any(Function)
		);
	});

	it("should call cache clean after transporter connected", () => {
		const broker = new ServiceBroker({ logger: false });
		const cacher = new MemoryLRUCacher();
		cacher.clean = mock.fn();

		cacher.init(broker);

		broker.localBus.emit("$transporter.connected");

		expect(cacher.clean).toHaveBeenCalledTimes(1);
	});
});

describe("Test MemoryLRUCacher set & get", () => {
	const broker = new ServiceBroker({ logger: false });
	const cacher = new MemoryLRUCacher();
	cacher.init(broker);

	const key = "tst123";
	const data1 = {
		a: 1,
		b: false,
		c: "Test",
		d: {
			e: 55
		}
	};

	it("should save the data with key", () => {
		cacher.set(key, data1);
		expect(cacher.cache.get(key)).toBe(data1);
	});

	it("should give back the data by key", () => {
		return cacher.get(key).then(obj => {
			expect(obj).toBeDefined();
			expect(obj).toEqual(data1);
		});
	});

	it("should give undefined if key not exist", () => {
		return cacher.get("123123").then(obj => {
			expect(obj).toBeUndefined();
		});
	});
});

describe("Test MemoryLRUCacher set & get with missingResponse", () => {
	const broker = new ServiceBroker({ logger: false });
	const MISSING = Symbol("MISSING");
	const cacher = new MemoryLRUCacher({ missingResponse: MISSING });
	cacher.init(broker);

	const key = "tst123";
	const data1 = {
		a: 1,
		b: false,
		c: "Test",
		d: {
			e: 55
		}
	};

	it("should save the data with key", () => {
		cacher.set(key, data1);
		expect(cacher.cache.get(key)).toBe(data1);
	});

	it("should give back the data by key", () => {
		return cacher.get(key).then(obj => {
			expect(obj).toBeDefined();
			expect(obj).toEqual(data1);
		});
	});

	it("should give undefined if key not exist", () => {
		return cacher.get("123123").then(obj => {
			expect(obj).toBe(MISSING);
		});
	});
});

describe("Test MemoryLRUCacher set & get with default cloning enabled", () => {
	const broker = new ServiceBroker({ logger: false });
	const cacher = new MemoryLRUCacher({ clone: true });
	cacher.init(broker);

	const key = "tst123";
	const data1 = {
		a: 1,
		b: false,
		c: "Test",
		d: {
			e: 55
		}
	};

	after(async () => {
		await cacher.close();
		await broker.stop();
	});

	it("should give back the data by key", async () => {
		const cached_response = await cacher.set(key, data1);

		// Cloned object. References different object
		expect(cached_response).not.toBe(data1);
		expect(cached_response).toEqual(data1);

		const obj = await cacher.get(key);
		expect(obj).toBeDefined();
		// Cloned object. References different object
		expect(obj).not.toBe(data1);
		expect(obj).toEqual(data1);

		const obj2 = await cacher.get(key);
		expect(obj2).toBeDefined();

		// Cloned object. References different objects
		expect(obj2).not.toBe(obj);
		expect(obj).not.toBe(data1);

		expect(obj2).toEqual(data1);
	});
});

describe("Test MemoryLRUCacher set & get with default cloning disabled", () => {
	const broker = new ServiceBroker({ logger: false });
	const cacher = new MemoryLRUCacher({ clone: false });
	cacher.init(broker);

	const key = "tst123";
	const data1 = {
		a: 1,
		b: false,
		c: "Test",
		d: {
			e: 55
		}
	};

	after(async () => {
		await cacher.close();
		await broker.stop();
	});

	it("should give back the data by key", async () => {
		const cached_response = await cacher.set(key, data1);

		// Not a clone. References the same entry
		expect(cached_response).toBe(data1);
		expect(cached_response).toEqual(data1);

		const obj = await cacher.get(key);
		expect(obj).toBeDefined();
		// Not a clone. References the same entry
		expect(obj).toBe(data1);
		expect(obj).toEqual(data1);

		const obj2 = await cacher.get(key);
		expect(obj2).toBeDefined();

		// Not a clone. Reference the same entry
		expect(obj2).toBe(obj);
		expect(obj).toBe(data1);
		expect(obj2).toEqual(data1);
	});
});

describe("Test MemoryLRUCacher set & get with custom cloning", () => {
	const clone = mock.fn(data => JSON.parse(JSON.stringify(data)));
	const broker = new ServiceBroker({ logger: false });
	const cacher = new MemoryLRUCacher({ clone });
	cacher.init(broker);

	const key = "tst123";
	const data1 = {
		a: 1,
		b: false,
		c: "Test",
		d: {
			e: 55
		}
	};

	after(async () => {
		await cacher.close();
		await broker.stop();
	});

	it("should give back the data by key", async () => {
		await cacher.set(key, data1);

		const obj = await cacher.get(key);
		expect(obj).toBeDefined();
		expect(obj).not.toBe(data1);
		expect(obj).toEqual(data1);

		// 1 with set + 1 with  get
		expect(clone).toHaveBeenCalledTimes(2);
		expect(clone).toHaveBeenCalledWith(data1);
	});
});

describe("Test MemoryLRUCacher delete", () => {
	const broker = new ServiceBroker({ logger: false });
	const cacher = new MemoryLRUCacher();
	cacher.init(broker);

	const key = "tst123";
	const data1 = {
		a: 1,
		b: false,
		c: "Test",
		d: {
			e: 55
		}
	};

	it("should save the data with key", () => {
		return cacher.set(key, data1);
	});

	it("should delete the key", () => {
		expect(cacher.cache.get(key)).toBeDefined();
		cacher.del(key);
		expect(cacher.cache.get(key)).toBeUndefined();
	});

	it("should give undefined", () => {
		return cacher.get(key).then(obj => {
			expect(obj).toBeUndefined();
		});
	});

	it("should delete multiple keys", () => {
		cacher.set("key1", "value1");
		cacher.set("key2", "value2");
		cacher.set("key3", "value3");

		cacher.del(["key1", "key3"]);

		expect(cacher.cache.get("key1")).toBeUndefined();
		expect(cacher.cache.get("key2")).toEqual("value2");
		expect(cacher.cache.get("key3")).toBeUndefined();
	});
});

describe("Test MemoryLRUCacher clean", () => {
	const broker = new ServiceBroker({ logger: false });
	const cacher = new MemoryLRUCacher({});
	cacher.init(broker);

	const key1 = "tst123";
	const key2 = "posts123";
	const data1 = {
		a: 1,
		b: false,
		c: "Test",
		d: {
			e: 55
		}
	};
	const data2 = "Data2";

	it("should save the data with key", () => {
		cacher.set(key1, data1);
		cacher.set(key2, data2);
	});

	it("should give item in cache for keys", () => {
		expect(cacher.cache.get(key1)).toBeDefined();
		expect(cacher.cache.get(key2)).toBeDefined();
	});

	it("should clean test* keys", () => {
		cacher.clean("tst*");
	});

	it("should give undefined for key1", () => {
		return cacher.get(key1).then(obj => {
			expect(obj).toBeUndefined();
		});
	});

	it("should give back data 2 for key2", () => {
		return cacher.get(key2).then(obj => {
			expect(obj).toEqual(data2);
		});
	});

	it("should clean all keys", () => {
		cacher.clean();
		expect(cacher.cache.size).toBe(0);
	});

	it("should give undefined for key2 too", () => {
		return cacher.get(key1).then(obj => {
			expect(obj).toBeUndefined();
		});
	});

	it("should clean by multiple patterns", () => {
		cacher.set("key.1", "value1");
		cacher.set("key.2", "value2");
		cacher.set("key.3", "value3");

		cacher.set("other.1", "value1");
		cacher.set("other.2", "value2");
		cacher.set("other.3", "value3");

		cacher.clean(["key.*", "*.2"]);

		expect(cacher.cache.get("key.1")).toBeUndefined();
		expect(cacher.cache.get("key.2")).toBeUndefined();
		expect(cacher.cache.get("key.3")).toBeUndefined();
		expect(cacher.cache.get("other.1")).toBeDefined();
		expect(cacher.cache.get("other.2")).toBeUndefined();
		expect(cacher.cache.get("other.3")).toBeDefined();
	});
});

describe("Test MemoryLRUCacher expired method", () => {
	let clock:any;
	let cacher:any;
	let broker:any;

	// `lru-cache` 在模块加载时就捕获了 `global.performance`（它用 `performance.now()` 计算 TTL），
	// 而 `lolex.install()` 是**整体替换** `global.performance`：若只是 install，先前加载的 lru-cache
	// 仍持有旧的 performance 引用，TTL 便不会跟随假时钟（实测如此）。因此这里在装好假时钟之后清空
	// 模块注册表并重新加载 cacher，让它拿到被 fake 的 performance —— 等价于"原地改写 performance.now"
	// 那种做法的效果。
	before(async () => {
		clock = lolex.install();
		// 起点不能是 0：lru-cache 把 `starts[index] === 0` 当成"该条目没有 TTL"
		// （源码里 `if (!ttl || !start) return Infinity`，且 `isStale` 里 `!!s` 直接短路），
		// 于是首条记录永不过期。原 clock-mock 版本那句 `clock.advance(1)` 就是为跳过 0，
		// 这里用 `tick(1)` 等价表达（会同时把 performance.now() 推离 0）。
		clock.tick(1);
		jest.resetModules();
		const ExpiredCacher = interopDefault(require("../../../src/cachers/memory-lru"));
		broker = new ServiceBroker({ logger: false });
		cacher = new ExpiredCacher({
			ttl: 60
		});
		cacher.init(broker); // for empty logger
	});

	after(async () => {
		clock.uninstall();
	});

	const key1 = "tst123";
	const key2 = "posts123";
	const data1 = {
		a: 1,
		b: false,
		c: "Test",
		d: {
			e: 55
		}
	};
	const data2 = "Data2";

	it("should save the data with key", () => {
		cacher.set(key1, data1);
		clock.tick(35 * 1000);
		cacher.set(key2, data2);
	});

	it("should give undefined for key1", () => {
		clock.tick(30 * 1000);

		return cacher.get(key1).then(obj => {
			expect(obj).toBeUndefined();
		});
	});

	it("should give back data 2 for key2", () => {
		return cacher.get(key2).then(obj => {
			expect(obj).toEqual(data2);
		});
	});

	it("should give back data 2 for key2", () => {
		clock.tick(65 * 1000);
		return cacher.get(key2).then(obj => {
			expect(obj).toBeUndefined();
		});
	});
});

describe("Test MemoryCacher getWithTTL method", () => {
	const cacher = new MemoryLRUCacher({
		ttl: 30,
		lock: true
	});
	const broker = new ServiceBroker({
		logger: false,
		cacher
	});
	const get = mock.method(cacher, "get");
	const getWithTTL = mock.method(cacher, "getWithTTL");
	const lock = mock.method(cacher, "lock");
	const key1 = "abcd1234";
	it("should return data and ttl", () => {
		return cacher.set(key1, "hello").then(() => {
			return cacher.getWithTTL(key1).then(res => {
				expect(res.data).toEqual("hello");
				expect(res.ttl).toBeDefined();
			});
		});
	});
});

describe("Test MemoryCacher getCacheKeys method", () => {
	const cacher = new MemoryLRUCacher({
		ttl: 30,
		lock: true
	});
	const broker = new ServiceBroker({
		logger: false,
		cacher
	});
	it("should return data and ttl", () => {
		return Promise.all([
			cacher.set("hello", "test"),
			cacher.set("hello2", "test"),
			cacher.set("hello3:test", "test")
		])
			.then(() => {
				return cacher.getCacheKeys();
			})
			.then(res => {
				expect(res).toEqual(
					expect.arrayContaining([
						{ key: "hello3:test" },
						{ key: "hello2" },
						{ key: "hello" }
					])
				);
			});
	});
});
