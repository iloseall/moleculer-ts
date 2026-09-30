import { describe, it } from "../../../helpers/test";
import expect from "../../../helpers/expect";

import { BrokerOptionsError } from "../../../../src/errors";
import TracingExporters from "../../../../src/tracing/exporters";

describe("Test TracingExporters resolver", () => {
	it("should throw error", () => {
		expect(() => TracingExporters.resolve()).toThrowError(BrokerOptionsError);
		expect(() => TracingExporters.resolve({})).toThrowError(BrokerOptionsError);
		expect(() => TracingExporters.resolve("xyz")).toThrowError(BrokerOptionsError);
		expect(() => TracingExporters.resolve({ type: "xyz" })).toThrowError(BrokerOptionsError);
	});

	it("should resolve console tracing exporter from string", () => {
		const reporter = TracingExporters.resolve("Console");
		expect(reporter).toBeInstanceOf(TracingExporters.Console);
	});

	it("should resolve console tracing exporter from obj", () => {
		const options = { interval: 2000 };
		const reporter = TracingExporters.resolve({ type: "Console", options });
		expect(reporter).toBeInstanceOf(TracingExporters.Console);
		expect(reporter.opts).toEqual(expect.objectContaining({ interval: 2000 }));
	});

	it("should resolve Datadog tracing exporter from string", () => {
		const reporter = TracingExporters.resolve("Datadog");
		expect(reporter).toBeInstanceOf(TracingExporters.Datadog);
	});

	it("should resolve Datadog tracing exporter from obj", () => {
		const options = { interval: 2000 };
		const reporter = TracingExporters.resolve({ type: "Datadog", options });
		expect(reporter).toBeInstanceOf(TracingExporters.Datadog);
		expect(reporter.opts).toEqual(expect.objectContaining({ interval: 2000 }));
	});

	it("should resolve event tracing exporter from string", () => {
		const reporter = TracingExporters.resolve("Event");
		expect(reporter).toBeInstanceOf(TracingExporters.Event);
	});

	it("should resolve event tracing exporter from obj", () => {
		const options = { interval: 2000 };
		const reporter = TracingExporters.resolve({ type: "Event", options });
		expect(reporter).toBeInstanceOf(TracingExporters.Event);
		expect(reporter.opts).toEqual(expect.objectContaining({ interval: 2000 }));
	});

	it("should resolve Jaeger tracing exporter from string", () => {
		const reporter = TracingExporters.resolve("Jaeger");
		expect(reporter).toBeInstanceOf(TracingExporters.Jaeger);
	});

	it("should resolve Jaeger tracing exporter from obj", () => {
		const options = { interval: 2000 };
		const reporter = TracingExporters.resolve({ type: "Jaeger", options });
		expect(reporter).toBeInstanceOf(TracingExporters.Jaeger);
		expect(reporter.opts).toEqual(expect.objectContaining({ interval: 2000 }));
	});

	it("should resolve Zipkin tracing exporter from string", () => {
		const reporter = TracingExporters.resolve("Zipkin");
		expect(reporter).toBeInstanceOf(TracingExporters.Zipkin);
	});

	it("should resolve Zipkin tracing exporter from obj", () => {
		const options = { interval: 2000 };
		const reporter = TracingExporters.resolve({ type: "Zipkin", options });
		expect(reporter).toBeInstanceOf(TracingExporters.Zipkin);
		expect(reporter.opts).toEqual(expect.objectContaining({ interval: 2000 }));
	});
});

describe("Test TracingExporters register", () => {
	class MyCustom {}

	it("should throw error if type if not correct", () => {
		expect(() => {
			TracingExporters.resolve("MyCustom");
		}).toThrowError(BrokerOptionsError);
	});

	it("should register new type", () => {
		TracingExporters.register("MyCustom", MyCustom);
		expect(TracingExporters.MyCustom).toBe(MyCustom);
	});

	it("should find the new type", () => {
		const exporter = TracingExporters.resolve("MyCustom");
		expect(exporter).toBeInstanceOf(MyCustom);
	});
});
