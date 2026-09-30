import { describe, it } from "../../helpers/test";
import expect from "../../helpers/expect";

import { BrokerOptionsError } from "../../../src/errors";
import Serializers from "../../../src/serializers";

describe("Test Serializers resolver", () => {
	it("should resolve null from undefined", () => {
		const serializer = Serializers.resolve();
		expect(serializer).toBeInstanceOf(Serializers.JSON);
	});

	it("should resolve JSONSerializer from obj without type", () => {
		const serializer = Serializers.resolve({});
		expect(serializer).toBeInstanceOf(Serializers.JSON);
	});

	it("should resolve JSONSerializer from obj", () => {
		const serializer = Serializers.resolve({ type: "JSON" });
		expect(serializer).toBeInstanceOf(Serializers.JSON);
	});

	it("should throw error if type if not correct", () => {
		expect(() => {
			Serializers.resolve("xyz");
		}).toThrow(BrokerOptionsError);

		expect(() => {
			Serializers.resolve({ type: "xyz" });
		}).toThrow(BrokerOptionsError);
	});
});

describe("Test Serializers register", () => {
	class MyCustom {}

	it("should throw error if type if not correct", () => {
		expect(() => {
			Serializers.resolve("MyCustom");
		}).toThrow(BrokerOptionsError);
	});

	it("should register new type", () => {
		Serializers.register("MyCustom", MyCustom);
		expect(Serializers.MyCustom).toBe(MyCustom);
	});

	it("should find the new type", () => {
		const serializer = Serializers.resolve("MyCustom");
		expect(serializer).toBeInstanceOf(MyCustom);
	});
});
