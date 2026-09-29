import type { ServiceSchema } from "../src/service";

const HotSchema: ServiceSchema = {
	name: "hot",
	metadata: {
		scalable: true,
		priority: 5
	},

	actions: {
		hello() {
			return "Hello Moleculer!";
		}
	},
	events: {
		"test.event"(c) {
			this.logger.info("Event", c);
		}
	},
	created() {
		this.logger.info(">>> Service created!");
	},

	started() {
		this.logger.info(">>> Service started!");
	},

	stopped() {
		this.logger.info(">>> Service stopped!");
	}
};

export default HotSchema;
