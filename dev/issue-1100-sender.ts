import ServiceBroker from "../src/service-broker";
import TransitLogger from "../src/middlewares/debugging/transit-logger";
import TransmitCompression from "../src/middlewares/transmit/compression";
import Stream from "stream";

const broker = new ServiceBroker({
	nodeID: "sender",
	transporter: "NATS",
	serializer: "JSON",

	requestTimeout: 10 * 1000,

	middlewares: [
		TransmitCompression({ method: "gzip" })
		/*TransitLogger({
			folder: "logs/transit"
		})*/
	]
});

broker.createService({
	name: "sender",
	dependencies: ["receiver"],

	actions: {
		send: {
			async handler(ctx) {
				const participants = [];
				for (let i = 0; i < 100000; i++) {
					participants.push({ entry: i });
				}
				const stream = new Stream.Readable();
				stream.push(Buffer.from(JSON.stringify(participants)));
				stream.push(null);
				this.logger.info("sending stream...");
				const res = await ctx.call("receiver.receive", null, {
					stream,
					meta: {
						//! meta data is missing on receiver side
						testMeta: "testMeta",
						participants: participants.slice(0, 100)
					}
				});
				this.logger.info("finished sending stream", res);
				return res;
			}
		}
	}
});

broker.start().then(async () => {
	broker.repl();
	await broker.Promise.delay(2000);
	broker.logger.info("Calling send...");
	await broker.call("sender.send");
});
