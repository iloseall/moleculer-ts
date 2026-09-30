/**
 * Self-test for the expect layer: every matcher/asymmetric matcher the suite
 * relies on has to keep working through `helpers/expect`.
 */
import { describe, it, mock } from "./test";
import expect from "./expect";

describe("expect compat layer", () => {
	it("toBe / toEqual / toStrictEqual", () => {
		expect(1 + 1).toBe(2);
		expect({ a: 1 }).toEqual({ a: 1 });
		expect({ a: 1 }).toStrictEqual({ a: 1 });
		expect("x").not.toBe("y");
	});

	it("toBeInstanceOf / toBeNull / toBeUndefined / toBeNaN", () => {
		expect(new Error("x")).toBeInstanceOf(Error);
		expect(null).toBeNull();
		expect(undefined).toBeUndefined();
		expect(NaN).toBeNaN();
	});

	it("numeric matchers", () => {
		expect(5).toBeGreaterThan(3);
		expect(5).toBeGreaterThanOrEqual(5);
		expect(2).toBeLessThan(3);
		expect(0.1 + 0.2).toBeCloseTo(0.3, 5);
	});

	it("toContain / toContainEqual / toHaveLength / toMatch", () => {
		expect([1, 2, 3]).toContain(2);
		expect([{ a: 1 }]).toContainEqual({ a: 1 });
		expect("hello world").toContain("world");
		expect([1, 2]).toHaveLength(2);
		expect("hello").toMatch(/^h/);
	});

	it("toThrow string / regexp / ctor", () => {
		expect(() => {
			throw new Error("boom");
		}).toThrow("boom");
		expect(() => {
			throw new Error("boom");
		}).toThrow(/BOOM/i);
		expect(() => {
			throw new TypeError("t");
		}).toThrow(TypeError);
		expect(() => {
			/* no throw */
		}).not.toThrow();
	});

	it("asymmetric: expect.any", () => {
		expect("str").toEqual(expect.any(String));
		expect(42).toEqual(expect.any(Number));
		expect({ id: 5 }).toEqual({ id: expect.any(Number) });
		expect(() => {}).toEqual(expect.any(Function));
	});

	it("asymmetric: objectContaining / arrayContaining / stringContaining / stringMatching", () => {
		expect({ a: 1, b: 2, c: 3 }).toEqual(expect.objectContaining({ a: 1, b: 2 }));
		expect([1, 2, 3, 4]).toEqual(expect.arrayContaining([2, 3]));
		expect("hello world").toEqual(expect.stringContaining("world"));
		expect("hello").toEqual(expect.stringMatching(/^hel/));
	});

	it("mock.fn assertions", () => {
		const fn = mock.fn((x: number) => x * 2);
		fn(2);
		fn(3);
		expect(fn).toHaveBeenCalled();
		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenCalledWith(2);
		expect(fn).toHaveBeenCalledWith(3);
		expect(fn).toHaveBeenLastCalledWith(3);
		expect(fn).toHaveBeenNthCalledWith(1, 2);
		expect(fn).toHaveReturnedWith(4);
		expect(fn).toHaveReturnedWith(6);
		expect(fn).not.toHaveBeenCalledWith(99);
	});

	it("mock.fn with asymmetric args", () => {
		const fn = mock.fn();
		fn({ id: 1, name: "a" });
		expect(fn).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
	});

	it("mock.method assertions", () => {
		const obj = { hello: (name: string) => `hi ${name}` };
		const spied = mock.method(obj, "hello");
		obj.hello("bob");
		expect(spied).toHaveBeenCalledTimes(1);
		expect(spied).toHaveBeenCalledWith("bob");
		spied.mockRestore();
	});

	it("resolves / rejects", async () => {
		await expect(Promise.resolve(42)).resolves.toBe(42);
		await expect(Promise.reject(new Error("nope"))).rejects.toThrow("nope");
	});

	it("toMatchObject", () => {
		expect({ a: 1, b: { c: 2, d: 3 } }).toMatchObject({ b: { c: 2 } });
	});

	it("toBeAnyOf (custom)", () => {
		expect("a").toBeAnyOf(["a", "b", "c"]);
	});

	it("toHaveProperty", () => {
		expect({ a: { b: 5 } }).toHaveProperty("a.b", 5);
		expect({ a: { b: 5 } }).toHaveProperty(["a", "b"], 5);
	});
});
