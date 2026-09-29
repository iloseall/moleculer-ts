import { ServiceBroker } from "../";

const broker = new ServiceBroker({
	namespace: "test",
	logger: console,
	hotReload: true
});

broker.loadService("./examples/es6.class.service.ts");
broker.start();
