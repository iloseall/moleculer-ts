import _ from "lodash";
const Middlewares = require("..").Middlewares;
import ServiceBroker from "../src/service-broker";

// Create broker
const broker = new ServiceBroker({
	transporter: "NATS",
	logLevel: {
		"TX-COMPRESS": "debug",
		"*": "info"
	},
	middlewares: [Middlewares.Transmit.Compression()]
});

broker
	.start()
	.then(() => broker.repl())
	.then(() => {})
	.catch(err => broker.logger.error(err));
