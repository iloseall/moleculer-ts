import { MoleculerError } from "../src/errors";
import type { ServiceSchema } from "../src/service";

const MathSchema: ServiceSchema = {
	name: "math",
	actions: {
		add(ctx) {
			return Number(ctx.params.a) + Number(ctx.params.b);
		},

		sub(ctx) {
			return Number(ctx.params.a) - Number(ctx.params.b);
		},

		mult: {
			params: {
				a: "number",
				b: "number"
			},
			handler(ctx) {
				return Number(ctx.params.a) * Number(ctx.params.b);
			}
		},

		div: {
			params: {
				a: { type: "number", convert: true },
				b: { type: "number", notEqual: 0, convert: true }
			},
			handler(ctx) {
				const a = Number(ctx.params.a);
				const b = Number(ctx.params.b);
				if (b != 0 && !Number.isNaN(b)) return a / b;
				else throw new MoleculerError("Divide by zero!", 422, null, ctx.params);
			}
		}
	}
};

export default MathSchema;
