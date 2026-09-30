import ServiceBroker from "../src/service-broker";

// Create broker
const broker = new ServiceBroker({
	metrics: true,
	internalServices: {
		$node: {
			actions: {
				hello(ctx) {
					return `Hello ${ctx.params.name || "Anonymous"}!`;
				},
				options: false
			}
		}
	}
});

broker.start().then(() => {
	broker.repl();
});
