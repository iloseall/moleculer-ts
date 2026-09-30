import { describe, it, before, after, mock } from "../helpers/test";
import expect from "../helpers/expect";

import ServiceBroker from "../../src/service-broker";
import { ValidationError } from "../../src/errors";

describe("Test broker validator with actions", () => {
	const schema = {
		name: "test",
		actions: {
			withValidation: {
				params: {
					a: { type: "number" },
					b: { type: "number" }
				},
				handler: mock.fn(() => 123)
			},
			withoutValidation: {
				handler() {}
			}
		}
	};

	const broker = new ServiceBroker({ logger: false });
	broker.validator.validate = mock.fn();
	broker.createService(schema);

	before(() => broker.start());
	after(() => broker.stop());

	it("shouldn't wrap validation, if action can't contain params settings", () => {
		return broker.call("test.withoutValidation").then(() => {
			expect(broker.validator.validate).toHaveBeenCalledTimes(0);
		});
	});

	it("should call handler, if params are correct", () => {
		schema.actions.withValidation.handler.mockClear();
		const p = { a: 5, b: 10 };
		return broker.call("test.withValidation", p).then(res => {
			expect(res).toBe(123);
			expect(schema.actions.withValidation.handler).toHaveBeenCalledTimes(1);
		});
	});

	it("should throw ValidationError, if params is not correct", () => {
		schema.actions.withValidation.handler.mockClear();
		const p = { a: 5, b: "asd" };
		return broker.call("test.withValidation", p).catch(err => {
			expect(err).toBeInstanceOf(ValidationError);
			expect(schema.actions.withValidation.handler).toHaveBeenCalledTimes(0);
		});
	});
});
