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
	middlewares: [
		Middlewares.Transmit.Encryption(
			"12345678901234567890123456789012",
			"aes-256-cbc",
			"1234567890123456"
		)
	]
});

broker
	.start()
	.then(() => broker.repl())
	.then(() => {})
	.catch(err => broker.logger.error(err));
