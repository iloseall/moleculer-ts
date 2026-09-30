// Interactive REPL: kept as plain JS (needs stdin), so it resolves the built output.
// Run `npm run build` before it.
const ServiceBroker = require("../dist/service-broker");

const broker = new ServiceBroker({ logger: true });
broker.createService({
	name: "greeter",
	actions: {
		hello(ctx) {
			return "Hello!";
		}
	}
});

broker.start().then(() => (require("repl").start("mol $ ").context.broker = broker));
