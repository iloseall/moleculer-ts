import { describe, it, mock } from "../../helpers/test";
import expect from "../../helpers/expect";

import ServiceBroker from "../../../src/service-broker";
import Cacher from "../../../src/cachers/base";
import Context from "../../../src/context";
import MemoryCacher from "../../../src/cachers/memory";

describe("Test BaseCacher", () => {
	it("check constructor", () => {
		const cacher = new Cacher();
		expect(cacher).toBeDefined();
		expect(cacher.opts).toBeDefined();
		expect(cacher.opts.ttl).toBeNull();
		expect(cacher.connected).toBe(null);
		expect(cacher.init).toBeDefined();
		expect(cacher.close).toBeDefined();
		expect(cacher.get).toBeDefined();
		expect(cacher.set).toBeDefined();
		expect(cacher.del).toBeDefined();
		expect(cacher.clean).toBeDefined();
		expect(cacher.getCacheKey).toBeDefined();
		expect(cacher.middleware).toBeDefined();
		expect(cacher.missingResponse).toBeUndefined();
	});

	it("check constructor with empty opts", () => {
		const opts = {};
		const cacher = new Cacher(opts);
		expect(cacher.opts).toBeDefined();
		expect(cacher.opts.ttl).toBeNull();
		expect(cacher.opts.maxParamsLength).toBeNull();
	});

	it("check constructor with options", () => {
		const opts = { ttl: 500, maxParamsLength: 128 };
		const cacher = new Cacher(opts);
		expect(cacher).toBeDefined();
		expect(cacher.opts).toEqual(opts);
		expect(cacher.opts.ttl).toBe(500);
		expect(cacher.opts.maxParamsLength).toBe(128);
	});

	it("check init", () => {
		const broker = new ServiceBroker({ logger: false });
		broker.on = mock.fn();
		const cacher = new Cacher();

		mock.method(cacher, "registerMoleculerMetrics");

		cacher.init(broker);
		expect(cacher.broker).toBe(broker);
		expect(cacher.logger).toBeDefined();
		expect(cacher.prefix).toBe("MOL-");

		expect(cacher.registerMoleculerMetrics).toHaveBeenCalledTimes(1);
	});

	it("check registerMoleculerMetrics", () => {
		const broker = new ServiceBroker({ logger: false });
		const cacher = new Cacher();
		cacher.init(broker);

		broker.metrics.register = mock.fn();

		cacher.registerMoleculerMetrics();
		expect(broker.metrics.register).toHaveBeenCalledTimes(10);
	});

	it("check init with namespace", () => {
		const broker = new ServiceBroker({ logger: false, namespace: "uat-test" });
		const cacher = new Cacher();
		cacher.init(broker);

		expect(cacher.prefix).toBe("MOL-uat-test-");
	});

	it("check init with prefix", () => {
		const broker = new ServiceBroker({ logger: false, namespace: "uat-test" });
		const cacher = new Cacher({ prefix: "other" });
		cacher.init(broker);

		expect(cacher.prefix).toBe("other-");
	});

	it("check getCacheKey with keys", () => {
		const broker = new ServiceBroker({ logger: false });
		const cacher = new Cacher();

		cacher.init(broker);
		// Check result
		let res = cacher.getCacheKey(
			{ name: "posts.find.model" },
			{},
			{ params: { id: 1, name: "Bob" } }
		);
		expect(res).toBe('posts.find.model:id|1|name|"Bob"');

		// Same result, with same params
		const res2 = cacher.getCacheKey(
			{ name: "posts.find.model" },
			{},
			{ params: { id: 1, name: "Bob" } }
		);
		expect(res2).toEqual(res);

		// Different result, with different params
		const res3 = cacher.getCacheKey(
			{ name: "posts.find.model" },
			{},
			{ params: { id: 2, name: "Bob" } }
		);
		expect(res3).not.toEqual(res);
		expect(res3).toBe('posts.find.model:id|2|name|"Bob"');

		res = cacher.getCacheKey();
		expect(res).toBe(undefined);

		res = cacher.getCacheKey({ name: "posts.find" });
		expect(res).toBe("posts.find");

		res = cacher.getCacheKey({ name: "posts.find" }, {});
		expect(res).toBe("posts.find");

		res = cacher.getCacheKey({ name: "user" }, {}, { params: {} });
		expect(res).toBe("user:");

		res = cacher.getCacheKey({ name: "user" }, {}, { params: { a: 5 } });
		expect(res).toBe("user:a|5");

		res = cacher.getCacheKey({ name: "user" }, {}, { params: { a: [] } });
		expect(res).toBe("user:a|[]");

		res = cacher.getCacheKey({ name: "user" }, {}, { params: { a: null } });
		expect(res).toBe("user:a|null");

		res = cacher.getCacheKey({ name: "user" }, {}, { params: { a: undefined } });
		expect(res).toBe("user:a|undefined");

		res = cacher.getCacheKey({ name: "user" }, { keys: ["a"] }, { params: { a: 5 } });
		expect(res).toBe("user:5");

		res = cacher.getCacheKey({ name: "user" }, { keys: ["a"] }, { params: { a: { id: 5 } } });
		expect(res).toBe("user:id|5");

		res = cacher.getCacheKey({ name: "user" }, { keys: ["a"] }, { params: { a: [1, 3, 5] } });
		expect(res).toBe("user:[1|3|5]");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a"] },
			{ params: { a: 5, b: 3, c: 5 } }
		);
		expect(res).toBe("user:5");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a.b"] },
			{ params: { a: { b: "John" } } }
		);
		expect(res).toBe('user:"John"');

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a", "b", "c"] },
			{ params: { a: 5, b: 3, c: 5 } }
		);
		expect(res).toBe("user:5|3|5");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a", "b", "c"] },
			{ params: { a: 5, c: 5 } }
		);
		expect(res).toBe("user:5|undefined|5");

		res = cacher.getCacheKey({ name: "user" }, {}, { params: { a: "12345" } });
		expect(res).toBe('user:a|"12345"');

		res = cacher.getCacheKey({ name: "user" }, {}, { params: { a: ["12345"] } });
		expect(res).toBe('user:a|["12345"]');

		const d = new Date(1614529868608);
		res = cacher.getCacheKey({ name: "user" }, {}, { params: { a: d } });
		expect(res).toBe("user:a|1614529868608");

		res = cacher.getCacheKey({ name: "user" }, {}, { params: { a: Symbol("something") } });
		expect(res).toBe("user:a|Symbol(something)");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a", "c", "b"] },
			{ params: { a: 5, b: { id: 3 } } }
		);
		expect(res).toBe("user:5|undefined|id|3");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a", "c", "b.id"] },
			{ params: { a: 5, b: { id: 3, other: { status: true } } } }
		);
		expect(res).toBe("user:5|undefined|3");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a", "b.id", "b.other.status"] },
			{ params: { a: 5, b: { id: 3, other: { status: true } } } }
		);
		expect(res).toBe("user:5|3|true");

		res = cacher.getCacheKey({ name: "user" }, null, {
			params: { a: 5, b: { id: 3, other: { status: true } } }
		});
		expect(res).toBe("user:a|5|b|id|3|other|status|true");

		res = cacher.getCacheKey({ name: "user" }, { keys: [] }, { params: { a: 5, b: 3 } });
		expect(res).toBe("user");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a"] },
			{ params: { a: Object.create(null) } }
		);
		expect(res).toBe("user:");

		// Test with meta
		res = cacher.getCacheKey({ name: "user" }, {}, { params: { a: 5 }, meta: { user: "bob" } });
		expect(res).toBe("user:a|5");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a"] },
			{ params: { a: 5 }, meta: { user: "bob" } }
		);
		expect(res).toBe("user:5");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["user"] },
			{ params: { a: 5 }, meta: { user: "bob" } }
		);
		expect(res).toBe("user:undefined");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["#user"] },
			{ params: { a: 5 }, meta: { user: "bob" } }
		);
		expect(res).toBe('user:"bob"');

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["a", "#user"] },
			{ params: { a: 5 }, meta: { user: "bob" } }
		);
		expect(res).toBe('user:5|"bob"');

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["#user", "a"] },
			{ params: { a: 5 }, meta: { user: "bob" } }
		);
		expect(res).toBe('user:"bob"|5');

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["#user"] },
			{ params: { a: 5, user: "adam" }, meta: { user: "bob" } }
		);
		expect(res).toBe('user:"bob"');

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["#user"] },
			{ params: { a: 5 }, meta: null }
		);
		expect(res).toBe("user:undefined");

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["#a.b.c"] },
			{ meta: { a: { b: { c: "nested" } } } }
		);
		expect(res).toBe('user:"nested"');

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["@user"] },
			{ params: { a: 5, user: "adam" }, meta: { user: "bob" }, headers: { user: "kevin" } }
		);
		expect(res).toBe('user:"kevin"');

		res = cacher.getCacheKey(
			{ name: "user" },
			{ keys: ["@a.b.c"] },
			{ headers: { a: { b: { c: "nested" } } } }
		);
		expect(res).toBe('user:"nested"');
	});

	it("check getCacheKey with hashing", () => {
		const broker = new ServiceBroker({ logger: false });
		const cacher = new Cacher();
		let res;

		cacher.init(broker);

		const bigObj = {
			A: { C0: false, C1: true, C2: true, C3: "495f761d77d6294f", C4: true },
			B: { C0: true, C1: false, C2: true, C3: "5721c26bfddb7927", C4: false },
			C: { C0: "5d9e85c124d5d09e", C1: true, C2: 5366, C3: false, C4: false },
			D: { C0: false, C1: true, C2: "704473bca1242604", C3: false, C4: "6fc56107e69be769" },
			E: { C0: true, C1: true, C2: 4881, C3: true, C4: 1418 },
			F: { C0: true, C1: false, C2: false, C3: false, C4: true },
			G: { C0: false, C1: true, C2: false, C3: 6547, C4: 9565 },
			H: { C0: true, C1: 1848, C2: "232e6552d0b8aa98", C3: "1d50627abe5c0463", C4: 5251 },
			I: { C0: "ecd0e4eae08e4f", C1: "197bcb312fc17f60", C2: 4755, C3: true, C4: 9552 },
			J: {
				C0: false,
				C1: "1cc45cadbbf240f",
				C2: "4dbb352b21c3c2f3",
				C3: 5065,
				C4: "792b19631c78d4f6"
			},
			K: { C0: "13c23a525adf9e1f", C1: true, C2: true, C3: "589d3499abbf6765", C4: true },
			L: { C0: false, C1: true, C2: 4350, C3: "72f6c4f0e9beb03c", C4: "434b74b5ff500609" },
			M: { C0: 9228, C1: "5254b36ec238c266", C2: true, C3: "27b040089b057684", C4: true },
			N: { C0: "35d3c608ef8aac5e", C1: "23fbdbd520d5ae7d", C2: false, C3: 9061, C4: true },
			O: { C0: true, C1: true, C2: "2382f9fe7834e0cc", C3: true, C4: false },
			P: { C0: true, C1: false, C2: "38c0d40b91a9d1f6", C3: false, C4: 5512 },
			Q: { C0: true, C1: true, C2: true, C3: true, C4: true },
			R: { C0: "70bd27c06b067734", C1: true, C2: "5213493253b98636", C3: 8272, C4: 1264 },
			S: { C0: "61044125008e634c", C1: 9175, C2: true, C3: "225e3d912bfbc338", C4: false },
			T: { C0: "38edc77387da030a", C1: false, C2: "38d8b9e2525413fc", C3: true, C4: false },
			U: { C0: false, C1: "4b3962c3d26bddd0", C2: "1e66b069bad46643", C3: 3642, C4: 9225 },
			V: {
				C0: "1c40e44b54486080",
				C1: "5a560d81078bab02",
				C2: "1c131259e1e9aa61",
				C3: true,
				C4: 9335
			},
			W: { C0: false, C1: "7089b0ad438df2cb", C2: "216aec98f513ac08", C3: true, C4: false },
			X: { C0: "3b749354aac19f24", C1: 9626, C2: true, C3: false, C4: false },
			Y: { C0: 298, C1: "224075dadd108ef9", C2: 3450, C3: 2548, C4: true }
		};

		cacher.opts.maxParamsLength = 44;
		res = cacher.getCacheKey({ name: "abc.def" }, {}, { params: bigObj });
		expect(res).toBe("abc.def:NZM9OuUh6/tx+mcELOV3Z3EOaUo6f28bgdL76znnrS8=");

		cacher.opts.maxParamsLength = 94;
		res = cacher.getCacheKey({ name: "abc.def" }, {}, { params: bigObj });
		expect(res).toBe(
			'abc.def:A|C0|false|C1|true|C2|true|C3|"495f761d77d6294f"|CNZM9OuUh6/tx+mcELOV3Z3EOaUo6f28bgdL76znnrS8='
		);

		cacher.opts.maxParamsLength = 485;
		res = cacher.getCacheKey({ name: "abc.def" }, {}, { params: bigObj });
		expect(res).toBe(
			'abc.def:A|C0|false|C1|true|C2|true|C3|"495f761d77d6294f"|C4|true|B|C0|true|C1|false|C2|true|C3|"5721c26bfddb7927"|C4|false|C|C0|"5d9e85c124d5d09e"|C1|true|C2|5366|C3|false|C4|false|D|C0|false|C1|true|C2|"704473bca1242604"|C3|false|C4|"6fc56107e69be769"|E|C0|true|C1|true|C2|4881|C3|true|C4|1418|F|C0|true|C1|false|C2|false|C3|false|C4|true|G|C0|false|C1|true|C2|false|C3|6547|C4|9565|H|C0|true|C1|1848|C2|"232e6552d0b8aa98"|C3|"1d50627abe5c0463"|C4|NZM9OuUh6/tx+mcELOV3Z3EOaUo6f28bgdL76znnrS8='
		);

		cacher.opts.maxParamsLength = null;
		res = cacher.getCacheKey({ name: "abc.def" }, {}, { params: bigObj });
		expect(res).toBe(
			'abc.def:A|C0|false|C1|true|C2|true|C3|"495f761d77d6294f"|C4|true|B|C0|true|C1|false|C2|true|C3|"5721c26bfddb7927"|C4|false|C|C0|"5d9e85c124d5d09e"|C1|true|C2|5366|C3|false|C4|false|D|C0|false|C1|true|C2|"704473bca1242604"|C3|false|C4|"6fc56107e69be769"|E|C0|true|C1|true|C2|4881|C3|true|C4|1418|F|C0|true|C1|false|C2|false|C3|false|C4|true|G|C0|false|C1|true|C2|false|C3|6547|C4|9565|H|C0|true|C1|1848|C2|"232e6552d0b8aa98"|C3|"1d50627abe5c0463"|C4|5251|I|C0|"ecd0e4eae08e4f"|C1|"197bcb312fc17f60"|C2|4755|C3|true|C4|9552|J|C0|false|C1|"1cc45cadbbf240f"|C2|"4dbb352b21c3c2f3"|C3|5065|C4|"792b19631c78d4f6"|K|C0|"13c23a525adf9e1f"|C1|true|C2|true|C3|"589d3499abbf6765"|C4|true|L|C0|false|C1|true|C2|4350|C3|"72f6c4f0e9beb03c"|C4|"434b74b5ff500609"|M|C0|9228|C1|"5254b36ec238c266"|C2|true|C3|"27b040089b057684"|C4|true|N|C0|"35d3c608ef8aac5e"|C1|"23fbdbd520d5ae7d"|C2|false|C3|9061|C4|true|O|C0|true|C1|true|C2|"2382f9fe7834e0cc"|C3|true|C4|false|P|C0|true|C1|false|C2|"38c0d40b91a9d1f6"|C3|false|C4|5512|Q|C0|true|C1|true|C2|true|C3|true|C4|true|R|C0|"70bd27c06b067734"|C1|true|C2|"5213493253b98636"|C3|8272|C4|1264|S|C0|"61044125008e634c"|C1|9175|C2|true|C3|"225e3d912bfbc338"|C4|false|T|C0|"38edc77387da030a"|C1|false|C2|"38d8b9e2525413fc"|C3|true|C4|false|U|C0|false|C1|"4b3962c3d26bddd0"|C2|"1e66b069bad46643"|C3|3642|C4|9225|V|C0|"1c40e44b54486080"|C1|"5a560d81078bab02"|C2|"1c131259e1e9aa61"|C3|true|C4|9335|W|C0|false|C1|"7089b0ad438df2cb"|C2|"216aec98f513ac08"|C3|true|C4|false|X|C0|"3b749354aac19f24"|C1|9626|C2|true|C3|false|C4|false|Y|C0|298|C1|"224075dadd108ef9"|C2|3450|C3|2548|C4|true'
		);

		cacher.opts.maxParamsLength = 44;
		res = cacher.getCacheKey(
			{ name: "users.list" },
			{ keys: ["token"] },
			{
				params: {
					token: "eyJpZCI6Im9SMU1sS1hCdVVjSGlnM3QiLCJ1c2VybmFtZSI6ImljZWJvYiIsImV4cCI6MTUzNDYyMTk1MCwiaWF0IjoxNTI5NDM3OTUwfQ"
				}
			}
		);
		expect(res).toBe("users.list:2Svi96M2RiYDODbpezeRkz4mBFYpfvIpVZxZdC0gs6o=");

		cacher.opts.maxParamsLength = 44;
		res = cacher.getCacheKey(
			{ name: "users.list" },
			{ keys: ["id", "token"] },
			{
				params: {
					id: 123,
					token: "eyJpZCI6Im9SMU1sS1hCdVVjSGlnM3QiLCJ1c2VybmFtZSI6ImljZWJvYiIsImV4cCI6MTUzNDYyMTk1MCwiaWF0IjoxNTI5NDM3OTUwfQ"
				}
			}
		);
		expect(res).toBe("users.list:oV1Gcb2R2tSyJLBIYAIskfKvY202E2rscb7XiMbQ2Rs=");

		cacher.opts.maxParamsLength = 100;
		res = cacher.getCacheKey(
			{ name: "users.list" },
			{ keys: ["id"] },
			{
				params: {
					id: 123,
					token: "eyJpZCI6Im9SMU1sS1hCdVVjSGlnM3QiLCJ1c2VybmFtZSI6ImljZWJvYiIsImV4cCI6MTUzNDYyMTk1MCwiaWF0IjoxNTI5NDM3OTUwfQ"
				}
			}
		);
		expect(res).toBe("users.list:123");
	});

	it("check getCacheKey with custom keygen", () => {
		const broker = new ServiceBroker({ logger: false });
		const keygen = mock.fn(() => "custom");
		const actionKeygen = mock.fn(() => "actionKeygen");
		const cacher = new Cacher({ keygen });

		cacher.init(broker);

		const action = { name: "posts.find.model" };
		const opts = { keys: ["limit", "#user"] };
		const ctx = {
			params: { limit: 5 },
			meta: { user: "bob" },
			headers: { auth: false }
		};

		expect(cacher.getCacheKey(action, opts, ctx)).toBe("custom");
		expect(keygen).toHaveBeenCalledTimes(1);
		expect(keygen).toHaveBeenCalledWith(action, opts, ctx);

		opts.keygen = actionKeygen;
		expect(cacher.getCacheKey(action, opts, ctx)).toBe("actionKeygen");
		expect(actionKeygen).toHaveBeenCalledTimes(1);
		expect(actionKeygen).toHaveBeenCalledWith(action, opts, ctx);
	});
});

describe("Test middleware", () => {
	const cachedData = { num: 5 };

	const cacher = new Cacher();
	// Fake connection
	cacher.connected = true;
	const broker = new ServiceBroker({
		logger: false,
		cacher
	});

	cacher.get = mock.fn(() => Promise.resolve(cachedData));
	cacher.set = mock.fn();

	const mockAction = {
		name: "posts.find",
		cache: true,
		handler: mock.fn()
	};
	const params = { id: 3, name: "Antsa" };

	it("should give back the cached data and not called the handler", () => {
		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);
		expect(typeof cachedHandler).toBe("function");

		return cachedHandler(ctx).then(response => {
			expect(broker.cacher.get).toHaveBeenCalledTimes(1);
			expect(broker.cacher.get).toHaveBeenCalledWith('posts.find:id|3|name|"Antsa"');
			expect(mockAction.handler).toHaveBeenCalledTimes(0);
			expect(broker.cacher.set).toHaveBeenCalledTimes(0);
			expect(response).toBe(cachedData);
		});
	});

	it("should not give back cached data and should call the handler and call the 'cache.set' action with promise", () => {
		const resData = [1, 3, 5];
		const cacheKey = cacher.getCacheKey(mockAction, {}, { params });
		broker.cacher.get = mock.fn(() => Promise.resolve(undefined));
		mockAction.handler = mock.fn(() => Promise.resolve(resData));

		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);

		return cachedHandler(ctx).then(response => {
			expect(response).toBe(resData);
			expect(mockAction.handler).toHaveBeenCalledTimes(1);

			expect(broker.cacher.get).toHaveBeenCalledTimes(1);
			expect(broker.cacher.get).toHaveBeenCalledWith(cacheKey);

			expect(broker.cacher.set).toHaveBeenCalledTimes(1);
			expect(broker.cacher.set).toHaveBeenCalledWith(cacheKey, resData, undefined);
		});
	});

	it("should call the 'cache.set' action with custom TTL", () => {
		const resData = [1];
		const cacheKey = cacher.getCacheKey(mockAction, {}, { params });
		broker.cacher.set.mockClear();
		broker.cacher.get = mock.fn(() => Promise.resolve(undefined));
		mockAction.handler = mock.fn(() => Promise.resolve(resData));
		mockAction.cache = { ttl: 8 };

		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);

		return cachedHandler(ctx).then(response => {
			expect(response).toBe(resData);
			expect(mockAction.handler).toHaveBeenCalledTimes(1);

			expect(broker.cacher.get).toHaveBeenCalledTimes(1);
			expect(broker.cacher.get).toHaveBeenCalledWith(cacheKey);

			expect(broker.cacher.set).toHaveBeenCalledTimes(1);
			expect(broker.cacher.set).toHaveBeenCalledWith(cacheKey, resData, 8);
		});
	});

	it("should not call cacher.get & set if cache = false", () => {
		const action = {
			name: "posts.get",
			cache: false,
			handler: mock.fn(() => Promise.resolve(cachedData))
		};
		cacher.get.mockClear();
		cacher.set.mockClear();

		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(action.handler, action);
		expect(typeof cachedHandler).toBe("function");

		return cachedHandler(ctx).then(() => {
			expect(cachedHandler).toBe(action.handler);
			expect(broker.cacher.get).toHaveBeenCalledTimes(0);
			expect(action.handler).toHaveBeenCalledTimes(1);
			expect(broker.cacher.set).toHaveBeenCalledTimes(0);
		});
	});

	it("should not call cacher.get & set if cache = { enabled: false }", () => {
		const action = {
			name: "posts.get",
			cache: {
				enabled: false
			},
			handler: mock.fn(() => Promise.resolve(cachedData))
		};
		cacher.get.mockClear();
		cacher.set.mockClear();

		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(action.handler, action);
		expect(typeof cachedHandler).toBe("function");

		return cachedHandler(ctx).then(() => {
			expect(cachedHandler).toBe(action.handler);
			expect(broker.cacher.get).toHaveBeenCalledTimes(0);
			expect(action.handler).toHaveBeenCalledTimes(1);
			expect(broker.cacher.set).toHaveBeenCalledTimes(0);
		});
	});

	it("should call custom enabled function", () => {
		const action = {
			name: "posts.get",
			cache: {
				enabled: ctx => ctx.params.cache !== false
			},
			handler: mock.fn(() => Promise.resolve(cachedData))
		};
		cacher.get.mockClear();
		cacher.set.mockClear();

		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(action.handler, action);
		expect(typeof cachedHandler).toBe("function");

		return cachedHandler(ctx).then(() => {
			expect(broker.cacher.get).toHaveBeenCalledTimes(1);
			expect(action.handler).toHaveBeenCalledTimes(1);
			expect(broker.cacher.set).toHaveBeenCalledTimes(1);

			ctx.setParams({ cache: false });
			cacher.get.mockClear();
			cacher.set.mockClear();
			action.handler.mockClear();

			return cachedHandler(ctx).then(() => {
				expect(broker.cacher.get).toHaveBeenCalledTimes(0);
				expect(action.handler).toHaveBeenCalledTimes(1);
				expect(broker.cacher.set).toHaveBeenCalledTimes(0);
			});
		});
	});

	it("should not use cache if ctx.meta.$cache === false", () => {
		const action = {
			name: "posts.get",
			cache: {
				enabled: true
			},
			handler: mock.fn(() => Promise.resolve(cachedData))
		};
		cacher.get.mockClear();
		cacher.set.mockClear();

		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(action.handler, action);
		expect(typeof cachedHandler).toBe("function");

		return cachedHandler(ctx).then(() => {
			expect(broker.cacher.get).toHaveBeenCalledTimes(1);
			expect(action.handler).toHaveBeenCalledTimes(1);
			expect(broker.cacher.set).toHaveBeenCalledTimes(1);

			ctx.meta.$cache = false;
			cacher.get.mockClear();
			cacher.set.mockClear();
			action.handler.mockClear();

			return cachedHandler(ctx).then(() => {
				expect(broker.cacher.get).toHaveBeenCalledTimes(0);
				expect(action.handler).toHaveBeenCalledTimes(1);
				expect(broker.cacher.set).toHaveBeenCalledTimes(0);
			});
		});
	});

	it("should call the handler if the connection to cacher is lost", () => {
		cacher.connected = false; // <- cacher lost connection

		const action = {
			name: "posts.get",
			cache: {
				enabled: true
			},
			// Return what you receive
			handler: mock.fn(() => Promise.resolve(params))
		};

		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(action.handler, action);
		expect(typeof cachedHandler).toBe("function");

		return cachedHandler(ctx).then(response => {
			expect(broker.cacher.get).toHaveBeenCalledTimes(0);
			expect(action.handler).toHaveBeenCalledTimes(1);
			expect(response).toBe(params);
		});
	});
});

describe("Test middleware with lock enabled", () => {
	const cachedData = { num: 5 };

	const cacher = new Cacher();
	// Fake connection
	cacher.connected = true;

	const broker = new ServiceBroker({
		logger: false,
		cacher
	});

	cacher.get = mock.fn(() => Promise.resolve(cachedData));
	cacher.set = mock.fn(() => Promise.resolve());
	cacher.getWithTTL = mock.fn(() => Promise.resolve({ data: cachedData, ttl: 15 }));

	const mockAction = {
		name: "posts.find",
		cache: {
			ttl: 60,
			lock: true
		},
		handler: mock.fn()
	};
	const params = { id: 6, name: "tiaod" };

	it("should give back the cached data and not called the handler", () => {
		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);
		expect(typeof cachedHandler).toBe("function");
		const cacheKey = cacher.getCacheKey(mockAction, {}, { params });
		return cachedHandler(ctx).then(response => {
			expect(broker.cacher.get).toHaveBeenCalledTimes(1);
			expect(broker.cacher.get).toHaveBeenCalledWith(cacheKey);

			expect(broker.cacher.getWithTTL).toHaveBeenCalledTimes(0);

			expect(broker.cacher.set).toHaveBeenCalledTimes(0);
			expect(mockAction.handler).toHaveBeenCalledTimes(0);
		});
	});

	it("should not give back cached data and should call the handler and call the 'cache.set' action with promise", () => {
		const resData = [1, 3, 5];
		const cacheKey = cacher.getCacheKey(mockAction, {}, { params });
		broker.cacher.get = mock.fn(() => Promise.resolve(undefined));
		broker.cacher.getWithTTL = mock.fn(() => Promise.resolve({ data: undefined, ttl: null }));
		const unlockFn = mock.fn(() => Promise.resolve());
		broker.cacher.lock = mock.fn(() => Promise.resolve(unlockFn));
		mockAction.handler = mock.fn(() => Promise.resolve(resData));

		const ctx = new Context();
		ctx.setParams(params);

		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);
		return cachedHandler(ctx).then(response => {
			expect(broker.cacher.getWithTTL).toHaveBeenCalledTimes(0); //Check the cache key and ttl

			expect(broker.cacher.get).toHaveBeenCalledTimes(2); // Check the cache after acquired the lock
			expect(broker.cacher.get).toHaveBeenCalledWith(cacheKey);

			expect(broker.cacher.set).toHaveBeenCalledTimes(1);
			expect(broker.cacher.set).toHaveBeenCalledWith(cacheKey, resData, 60);
			expect(response).toBe(resData);
		});
	});

	it("should disable cache lock by defalut", () => {
		const mockAction = {
			name: "post.get",
			cache: {
				ttl: 30
			}
		};
		broker.cacher.get = mock.fn(() => Promise.resolve(null));
		broker.cacher.getWithTTL = mock.fn(() => Promise.resolve({ data: null, ttl: null }));
		broker.cacher.lock = mock.fn(() => Promise.resolve());
		mockAction.handler = mock.fn(() => Promise.resolve());

		const ctx = new Context();
		ctx.setParams(params);

		const cacheKey = cacher.getCacheKey(mockAction, {}, { params });
		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);
		return cachedHandler(ctx).then(response => {
			expect(broker.cacher.lock).toHaveBeenCalledTimes(0);

			expect(broker.cacher.get).toHaveBeenCalledTimes(1);
			expect(broker.cacher.get).toHaveBeenCalledWith(cacheKey);
		});
	});

	it("should not call cacher.lock if cache.lock = false", () => {
		const mockAction = {
			name: "post.get",
			cache: {
				ttl: 30,
				lock: false
			}
		};
		broker.cacher.get = mock.fn(() => Promise.resolve(null));
		broker.cacher.getWithTTL = mock.fn(() => Promise.resolve({ data: null, ttl: null }));
		const unlockFn = mock.fn(() => Promise.resolve());
		broker.cacher.lock = mock.fn(() => Promise.resolve(unlockFn));
		mockAction.handler = mock.fn(() => Promise.resolve());

		const ctx = new Context();
		ctx.setParams(params);

		const cacheKey = cacher.getCacheKey(mockAction, {}, { params });
		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);
		return cachedHandler(ctx).then(response => {
			expect(broker.cacher.getWithTTL).toHaveBeenCalledTimes(0);
			expect(broker.cacher.lock).toHaveBeenCalledTimes(0);
			expect(broker.cacher.get).toHaveBeenCalledTimes(1);
			expect(broker.cacher.get).toHaveBeenCalledWith(cacheKey);
		});
	});

	it("should not call cacher.lock if cache.lock = { enabled: false }", () => {
		const mockAction = {
			name: "post.get",
			cache: {
				ttl: 30,
				lock: {
					enabled: false
				}
			}
		};
		broker.cacher.get = mock.fn(() => Promise.resolve(null));
		const unlockFn = mock.fn(() => Promise.resolve());
		broker.cacher.lock = mock.fn(() => Promise.resolve(unlockFn));
		broker.cacher.getWithTTL = mock.fn(() => Promise.resolve({ data: null, ttl: null }));
		mockAction.handler = mock.fn(() => Promise.resolve());

		const ctx = new Context();
		ctx.setParams(params);

		const cacheKey = cacher.getCacheKey(mockAction, {}, { params });
		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);
		return cachedHandler(ctx).then(response => {
			expect(broker.cacher.getWithTTL).toHaveBeenCalledTimes(0);
			expect(broker.cacher.lock).toHaveBeenCalledTimes(0);
			expect(broker.cacher.get).toHaveBeenCalledTimes(1);
			expect(broker.cacher.get).toHaveBeenCalledWith(cacheKey);
		});
	});

	it("should call the handler only once when concurrency call a cacher with lock", () => {
		const resData = [6, 6, 6];

		const cacher = new MemoryCacher();
		const broker = new ServiceBroker({
			logger: false,
			cacher
		});
		const mockAction = {
			name: "post.get",
			cache: {
				ttl: 30,
				lock: true
			}
		};
		const get = mock.method(cacher, "get");
		const getWithTTL = mock.method(cacher, "getWithTTL");
		const lock = mock.method(cacher, "lock");
		mockAction.handler = mock.fn(() => {
			return new Promise(function (resolve, reject) {
				setTimeout(() => resolve(resData), 1000);
			});
		});

		const ctx = new Context();
		ctx.setParams(params);

		const cacheKey = cacher.getCacheKey(mockAction, {}, { params });
		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);

		function call() {
			const ctx = new Context();
			ctx.setParams(params);
			return cachedHandler(ctx);
		}
		// Concurrency 3
		return Promise.all([call(), call(), call()])
			.then(responses => {
				for (const response of responses) {
					expect(response).toEqual(resData);
				}
				expect(mockAction.handler).toHaveBeenCalledTimes(1);
				expect(get).toHaveBeenCalledTimes(6);
				expect(getWithTTL).toHaveBeenCalledTimes(0);
				expect(lock).toHaveBeenCalledTimes(3);
			})
			.then(() => {
				return cacher.close();
			});
	});

	it("should realse the lock when an error throw", () => {
		const err = new Error("wrong");
		const mockAction = {
			name: "posts.find",
			cache: {
				ttl: 30,
				lock: true
			},
			handler: mock.fn(function (ctx) {
				return Promise.reject(err);
			})
		};
		broker.cacher.get = mock.fn(() => Promise.resolve(null));
		broker.cacher.getWithTTL = mock.fn(() => Promise.resolve({ data: null, ttl: null }));
		const unlockFn = mock.fn(() => Promise.resolve());
		broker.cacher.lock = mock.fn(() => Promise.resolve(unlockFn));
		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);
		return cachedHandler(new Context()).catch(e => {
			expect(e).toBe(err);
			expect(unlockFn).toHaveBeenCalledTimes(1);
		});
	});

	it("should refresh a stale key of cache", () => {
		const resData = [9, 9, 9];
		const mockAction = {
			name: "post.find",
			cache: {
				ttl: 30,
				lock: {
					staleTime: 10
				}
			},
			handler: mock.fn(() => Promise.resolve(resData))
		};
		broker.cacher.get = mock.fn(() => Promise.resolve(cachedData));
		broker.cacher.getWithTTL = mock.fn(() => Promise.resolve({ data: cachedData, ttl: 5 }));
		broker.cacher.set = mock.fn(() => Promise.resolve());
		const unlockFn = mock.fn(() => Promise.resolve());
		broker.cacher.lock = mock.fn(() => Promise.resolve(unlockFn));
		broker.cacher.tryLock = mock.fn(() => Promise.resolve(unlockFn));

		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);
		return new Promise(function (resolve, reject) {
			cachedHandler(new Context()).then(response => {
				expect(response).toBe(cachedData);
				expect(broker.cacher.get).toHaveBeenCalledTimes(0);
				expect(broker.cacher.getWithTTL).toHaveBeenCalledTimes(1);
				expect(broker.cacher.lock).toHaveBeenCalledTimes(0);
				expect(broker.cacher.tryLock).toHaveBeenCalledTimes(1);
				expect(mockAction.handler).toHaveBeenCalledTimes(1);
				setTimeout(resolve, 1000);
			});
		}).then(() => expect(unlockFn).toHaveBeenCalledTimes(1)); //Should finally unlock the lock.
	});

	it("should not call the handler if the cache is refreshed", () => {
		const resData = [8, 6, 4];
		const mockAction = {
			name: "post.find",
			cache: {
				ttl: 30,
				lock: {
					staleTime: 10
				}
			},
			handler: mock.fn(() => Promise.resolve(resData))
		};
		broker.cacher.get = mock.fn(() => Promise.resolve(cachedData));
		broker.cacher.getWithTTL = mock.fn(() => Promise.resolve({ data: cachedData, ttl: 25 }));
		broker.cacher.set = mock.fn(() => Promise.resolve());
		const unlockFn = mock.fn(() => Promise.resolve());
		broker.cacher.lock = mock.fn(() => Promise.resolve(unlockFn));
		broker.cacher.tryLock = mock.fn(() => Promise.resolve(unlockFn));

		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);
		return cachedHandler(new Context()).then(response => {
			expect(response).toBe(cachedData);
			expect(broker.cacher.get).toHaveBeenCalledTimes(0);
			expect(broker.cacher.getWithTTL).toHaveBeenCalledTimes(1);
			expect(broker.cacher.lock).toHaveBeenCalledTimes(0);
			expect(broker.cacher.tryLock).toHaveBeenCalledTimes(0);
			expect(unlockFn).toHaveBeenCalledTimes(0);
			expect(mockAction.handler).toHaveBeenCalledTimes(0);
		});
	});

	it("should realse the lock when refreshing a key and an error throw", () => {
		const err = new Error("wrong");
		const mockAction = {
			name: "posts.find",
			cache: {
				ttl: 30,
				lock: {
					staleTime: 10
				}
			},
			handler: mock.fn(ctx => Promise.reject(err))
		};

		broker.cacher.get = mock.fn(() => Promise.resolve(cachedData));
		broker.cacher.del = mock.fn(() => Promise.resolve());
		broker.cacher.getWithTTL = mock.fn(() => Promise.resolve({ data: cachedData, ttl: 5 }));
		broker.cacher.set = mock.fn(() => Promise.resolve());
		const unlockFn = mock.fn(() => Promise.resolve());
		broker.cacher.lock = mock.fn(() => Promise.resolve(unlockFn));
		broker.cacher.tryLock = mock.fn(() => Promise.resolve(unlockFn));
		const cacheKey = cacher.getCacheKey(mockAction, {}, { params });
		const cachedHandler = cacher.middleware().localAction(mockAction.handler, mockAction);

		const ctx = new Context();
		ctx.setParams(params);

		return new Promise(function (resolve, reject) {
			cachedHandler(ctx).then(response => {
				expect(response).toBe(cachedData);
				expect(broker.cacher.get).toHaveBeenCalledTimes(0);
				expect(broker.cacher.getWithTTL).toHaveBeenCalledTimes(1);
				expect(broker.cacher.lock).toHaveBeenCalledTimes(0);
				expect(broker.cacher.tryLock).toHaveBeenCalledTimes(1);
				expect(mockAction.handler).toHaveBeenCalledTimes(1);
				setTimeout(resolve, 1000);
			});
		}).then(() => {
			expect(unlockFn).toHaveBeenCalledTimes(1); //Should finally unlock the lock.
			expect(broker.cacher.del).toHaveBeenCalledTimes(1);
			expect(broker.cacher.del).toHaveBeenCalledWith(cacheKey);
		});
	});
});
