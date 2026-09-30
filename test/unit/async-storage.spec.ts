import { describe, it, before, mock } from "../helpers/test";
import expect from "../helpers/expect";
import { autoShape, factoryMock, installMock, interopDefault } from "../helpers/module-mock";

// The mock shape is patched *before* `src/async-storage` is required: every
// `require()` of a mocked module yields a fresh copy, but the mock functions
// inside are shared, so the spec and the module under test stay in sync.
const asyncHooksShape = autoShape(require.resolve("async_hooks"));

const executionAsyncIdMock = mock.fn(() => "currentUidMock");
asyncHooksShape.executionAsyncId = executionAsyncIdMock;

const enableHookMock = mock.fn();
const disableHookMock = mock.fn();
const createHookMock = mock
	.fn()
	.mockReturnValueOnce("createHookMock") // constructor test
	.mockReturnValue({ enable: enableHookMock, disable: disableHookMock });
asyncHooksShape.createHook = createHookMock;

installMock(require.resolve("async_hooks"), asyncHooksShape);

const asyncHooks: any = asyncHooksShape;
const AsyncStorage = interopDefault(require("../../src/async-storage"));

before(() => {
	mock.clearAllMocks();
});

describe("Test 'AsyncStorage' class", () => {
	const broker = {};

	describe("Test constructor", () => {
		it("should set broker & hook & executionAsyncId & store, ", () => {
			const _initBindMock = mock.fn(() => "_initBindMock");
			//const _beforeBindMock = mock.fn(() => "_beforeBindMock");
			//const _afterBindMock = mock.fn(() => "_afterBindMock");
			const _destroyBindMock = mock.fn(() => "_destroyBindMock");

			AsyncStorage.prototype._init.bind = _initBindMock;
			//AsyncStorage.prototype._before.bind = _becoreBindMock;
			//AsyncStorage.prototype._after.bind = _afterBindMock;
			AsyncStorage.prototype._destroy.bind = _destroyBindMock;

			// ---- ^ SETUP ^ ---
			const storage = new AsyncStorage(broker);
			// ---- ˇ ASSERTS ˇ ---

			expect(storage.broker).toBe(broker);
			expect(asyncHooks.createHook).toHaveBeenCalledTimes(1);
			expect(asyncHooks.createHook).toHaveBeenCalledWith({
				init: "_initBindMock",
				//before: "_beforeBindMock",
				//after: "_afterBindMock",
				destroy: "_destroyBindMock",
				promiseResolve: "_destroyBindMock"
			});
			expect(storage.hook).toEqual("createHookMock");

			const thisOnMock = {
				broker: {},
				executionAsyncId: executionAsyncIdMock,
				hook: "createHookMock",
				store: new Map()
			};
			expect(_initBindMock).toHaveBeenCalledTimes(1);
			expect(_initBindMock).toHaveBeenCalledWith(thisOnMock);
			//expect(_beforeBindMock).toHaveBeenCalledTimes(1);
			//expect(_beforeBindMock).toHaveBeenCalledWith(thisOnMock);
			//expect(_afterBindMock).toHaveBeenCalledTimes(1);
			//expect(_afterBindMock).toHaveBeenCalledWith(thisOnMock);
			expect(_destroyBindMock).toHaveBeenCalledTimes(2);
			expect(_destroyBindMock).toHaveBeenNthCalledWith(1, thisOnMock);
			expect(_destroyBindMock).toHaveBeenNthCalledWith(2, thisOnMock);
			expect(storage.executionAsyncId).toBe(executionAsyncIdMock);
			expect(storage.store).toBeInstanceOf(Map);
			expect(storage.store.size).toEqual(0);

			_initBindMock.mockClear();
			//_beforeBindMock.mockClear();
			//_afterBindMock.mockClear();
			_destroyBindMock.mockClear();
		});
	});

	describe("Test 'enable' function", () => {
		it("should call hook enable function", () => {
			const storage = new AsyncStorage(broker);
			// ---- ^ SETUP ^ ---
			storage.enable();
			// ---- ˇ ASSERTS ˇ ---
			expect(enableHookMock).toHaveBeenCalledTimes(1);
			expect(enableHookMock).toHaveBeenCalledWith();

			enableHookMock.mockClear();
		});
	});

	describe("Test 'disable' function", () => {
		it("should call hook disable function", () => {
			const storage = new AsyncStorage(broker);
			// ---- ^ SETUP ^ ---
			storage.disable();
			// ---- ˇ ASSERTS ˇ ---
			expect(disableHookMock).toHaveBeenCalledTimes(1);
			expect(disableHookMock).toHaveBeenCalledWith();

			disableHookMock.mockClear();
		});
	});

	describe("Test 'stop' function", () => {
		it("should call hook disable and store clear function", () => {
			const storage = new AsyncStorage(broker);
			mock.method(Map.prototype, "clear");
			// ---- ^ SETUP ^ ---
			storage.stop();
			// ---- ˇ ASSERTS ˇ ---
			expect(disableHookMock).toHaveBeenCalledTimes(1);
			expect(disableHookMock).toHaveBeenCalledWith();
			expect(storage.store.clear).toHaveBeenCalledTimes(1);
			expect(storage.store.clear).toHaveBeenCalledWith();

			disableHookMock.mockClear();
		});
	});

	describe("Test 'getAsyncId' method", () => {
		it("should call and return executionAsyncId function", () => {
			const storage = new AsyncStorage(broker);
			// ---- ^ SETUP ^ ---
			const res = storage.getAsyncId();
			// ---- ˇ ASSERTS ˇ ---
			expect(executionAsyncIdMock).toHaveBeenCalledTimes(1);
			expect(executionAsyncIdMock).toHaveBeenCalledWith();
			expect(res).toEqual("currentUidMock");

			executionAsyncIdMock.mockClear();
		});
	});

	describe("Test 'setSessionData' method", () => {
		it("should get executionAsyncId and set store", () => {
			const storage = new AsyncStorage(broker);
			storage.store = { set: mock.fn() };
			// ---- ^ SETUP ^ ---
			storage.setSessionData("dataMock");
			// ---- ˇ ASSERTS ˇ ---
			expect(executionAsyncIdMock).toHaveBeenCalledTimes(1);
			expect(executionAsyncIdMock).toHaveBeenCalledWith();
			expect(storage.store.set).toHaveBeenCalledTimes(1);
			expect(storage.store.set).toHaveBeenCalledWith("currentUidMock", {
				data: "dataMock",
				owner: "currentUidMock"
			});

			executionAsyncIdMock.mockClear();
		});
	});

	describe("Test 'getSessionData' method", () => {
		it("should get executionAsyncId and get item from store (item has data)", () => {
			const storage = new AsyncStorage(broker);
			storage.store = {
				get: mock.fn(() => {
					return {
						data: "itemDataMock"
					};
				})
			};
			// ---- ^ SETUP ^ ---
			const res = storage.getSessionData();
			// ---- ˇ ASSERTS ˇ ---
			expect(executionAsyncIdMock).toHaveBeenCalledTimes(1);
			expect(executionAsyncIdMock).toHaveBeenCalledWith();
			expect(storage.store.get).toHaveBeenCalledTimes(1);
			expect(storage.store.get).toHaveBeenCalledWith("currentUidMock");
			expect(res).toEqual("itemDataMock");

			executionAsyncIdMock.mockClear();
		});

		it("should get executionAsyncId and get item from store (item has no data)", () => {
			const storage = new AsyncStorage(broker);
			storage.store = {
				get: mock.fn()
			};
			// ---- ^ SETUP ^ ---
			const res = storage.getSessionData();
			// ---- ˇ ASSERTS ˇ ---
			expect(executionAsyncIdMock).toHaveBeenCalledTimes(1);
			expect(executionAsyncIdMock).toHaveBeenCalledWith();
			expect(storage.store.get).toHaveBeenCalledTimes(1);
			expect(storage.store.get).toHaveBeenCalledWith("currentUidMock");
			expect(res).toBeNull();

			executionAsyncIdMock.mockClear();
		});

		it("should getSessionData return what setSessionData set before", () => {
			const storage = new AsyncStorage(broker);
			const context = { a: 5 };
			storage.setSessionData(context);
			// ---- ^ SETUP ^ ---
			const storagedContext = storage.getSessionData();
			// ---- ˇ ASSERTS ˇ ---
			expect(storagedContext).toBe(context);
		});
	});

	describe("Test '_init' function", () => {
		it("should return if type is 'TIMERWRAP'", () => {
			const storage = new AsyncStorage(broker);
			storage.store = { get: mock.fn(), set: mock.fn() };
			// ---- ^ SETUP ^ ---
			const res = storage._init(null, "TIMERWRAP", null);
			// ---- ˇ ASSERTS ˇ ---
			expect(storage.store.get).toHaveBeenCalledTimes(0);
			expect(storage.store.set).toHaveBeenCalledTimes(0);
			expect(res).toBeUndefined();
		});

		it("should does nothing if store does not contain item by trigerAsyncId", () => {
			const storage = new AsyncStorage(broker);
			storage.store = { get: mock.fn(), set: mock.fn() };
			// ---- ^ SETUP ^ ---
			storage._init("asyncId", "NOT_TIMERWRAP", "triggerAsyncId");
			// ---- ˇ ASSERTS ˇ ---
			expect(storage.store.get).toHaveBeenCalledTimes(1);
			expect(storage.store.get).toHaveBeenCalledWith("triggerAsyncId");
			expect(storage.store.set).toHaveBeenCalledTimes(0);
		});

		it("should set item in store (triggerAsyncId -> asyncId)", () => {
			const storage = new AsyncStorage(broker);
			storage.store = { get: mock.fn(() => "itemMock"), set: mock.fn() };
			// ---- ^ SETUP ^ ---
			storage._init("asyncId", "NOT_TIMERWRAP", "triggerAsyncId");
			// ---- ˇ ASSERTS ˇ ---
			expect(storage.store.get).toHaveBeenCalledTimes(1);
			expect(storage.store.get).toHaveBeenCalledWith("triggerAsyncId");
			expect(storage.store.set).toHaveBeenCalledTimes(1);
			expect(storage.store.set).toHaveBeenCalledWith("asyncId", "itemMock");
		});
	});

	describe("Test '_destroy' function", () => {
		it("should does nothing if store does not contain item by trigerAsyncId", () => {
			const storage = new AsyncStorage(broker);
			storage.store = { get: mock.fn(), delete: mock.fn() };
			// ---- ^ SETUP ^ ---
			storage._destroy("asyncId");
			// ---- ˇ ASSERTS ˇ ---
			expect(storage.store.get).toHaveBeenCalledTimes(1);
			expect(storage.store.get).toHaveBeenCalledWith("asyncId");
			expect(storage.store.delete).toHaveBeenCalledTimes(0);
		});

		it("should delete item from store by asyncId", () => {
			const storage = new AsyncStorage(broker);
			storage.store = {
				get: mock.fn(() => "itemMock"),
				delete: mock.fn()
			};
			// ---- ^ SETUP ^ ---
			storage._destroy("asyncId");
			// ---- ˇ ASSERTS ˇ ---
			expect(storage.store.get).toHaveBeenCalledTimes(1);
			expect(storage.store.get).toHaveBeenCalledWith("asyncId");
			expect(storage.store.delete).toHaveBeenCalledTimes(1);
			expect(storage.store.delete).toHaveBeenCalledWith("asyncId");
		});

		// Commented case
		/*it("should delete item from store by asyncId and delete owner if equal asyncId", () => {
			const storage = new AsyncStorage(broker);
			let data = { owner: "asyncId", data: "dataMock" };
			storage.store = {
				get: mock.fn(() => {
					return data;
				}),
				delete: mock.fn(),
			};
			// ---- ^ SETUP ^ ---
			storage._destroy("asyncId");
			// ---- ˇ ASSERTS ˇ ---
			expect(storage.store.get).toHaveBeenCalledTimes(1);
			expect(storage.store.get).toHaveBeenCalledWith("asyncId");
			expect(storage.store.delete).toHaveBeenCalledTimes(1);
			expect(storage.store.delete).toHaveBeenCalledWith("asyncId");
			expect(data.data).tobeNull();
		});*/
	});
});
