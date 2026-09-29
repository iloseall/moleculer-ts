import type { ServiceSchema } from "../src/service";

const TestSchema: ServiceSchema = {
	name: "test",
	actions: {
		fatal() {
			this.logger.fatal("Fatal error!");
		}
	}
};

export default TestSchema;
