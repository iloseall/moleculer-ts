import { describe, it, beforeEach, mock } from "../../../helpers/test";
import expect from "../../../helpers/expect";

import * as P from "../../../../src/packets";
import Parser from "../../../../src/transporters/tcp/parser";

describe("Test Parser constructor", () => {
	it("check constructor", () => {
		const opts = {};

		const parser = new Parser(opts, 5000);

		expect(parser.maxPacketSize).toBe(5000);
		expect(parser.buf).toBeNull();
	});
});

describe("Test Parser write", () => {
	let parser;
	const onError = mock.fn();
	const onData = mock.fn();

	beforeEach(() => {
		parser = new Parser(null, 512);
		parser.on("error", onError);
		parser.on("data", onData);
	});

	it("should store chunk in buffer if length is smaller than 6 bytes", () => {
		const cb = mock.fn();

		const buf = Buffer.alloc(5, "0");
		parser._write(buf, null, cb);

		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith();
		expect(parser.buf).toBeInstanceOf(Buffer);
		expect(parser.buf.toString()).toBe("00000");
	});

	it("should concat previous chunk and throw CRC error", () => {
		const cb = mock.fn();

		// Preload buffer
		parser.buf = Buffer.alloc(5, "0");

		const buf = Buffer.alloc(5, "1");
		parser._write(buf, null, cb);

		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith(expect.any(Error));
		const err = cb.mock.calls[0][0];
		expect(err.message).toBe("Invalid packet CRC! 49");
		expect(parser.buf).toBeNull();
	});

	it("should throw error if packet is too large", () => {
		const cb = mock.fn();

		const buf = Buffer.alloc(513, "0");
		parser._write(buf, null, cb);

		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith(expect.any(Error));
		const err = cb.mock.calls[0][0];
		expect(err.message).toBe(
			"Incoming packet is larger than the 'maxPacketSize' limit (513 > 512)!"
		);
		expect(parser.buf).toBeNull();
	});

	it("should throw error on a negative length field without hanging", () => {
		const cb = mock.fn();

		// Craft a packet with the sign bit set in the length field (0x80000000 =>
		// -2147483648 as signed int32) and a matching CRC. Without the length
		// guard this would spin forever in `_write`.
		const buf = Buffer.alloc(10, 0);
		buf.writeInt32BE(-2147483648, 1);
		buf[5] = 4; // PACKET_PING_ID
		buf[0] = buf[1] ^ buf[2] ^ buf[3] ^ buf[4] ^ buf[5]; // valid CRC

		parser._write(buf, null, cb);

		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith(expect.any(Error));
		const err = cb.mock.calls[0][0];
		expect(err.message).toBe("Invalid packet length! -2147483648");
		expect(onData).not.toHaveBeenCalled();
		expect(parser.buf).toBeNull();
	});

	it("should throw error on a length field smaller than the header", () => {
		const cb = mock.fn();

		// length = 3 (smaller than the 6-byte header) => slice(3) would not shrink
		// enough to terminate the loop with a 6+ byte buffer.
		const buf = Buffer.from([0, 0, 0, 0, 3, 6, 100, 97, 116, 97]);
		buf[0] = buf[1] ^ buf[2] ^ buf[3] ^ buf[4] ^ buf[5]; // valid CRC

		parser._write(buf, null, cb);

		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith(expect.any(Error));
		const err = cb.mock.calls[0][0];
		expect(err.message).toBe("Invalid packet length! 3");
		expect(parser.buf).toBeNull();
	});

	it("should emit data with valid chunk", () => {
		const cb = mock.fn();

		const buf = Buffer.from([12, 0, 0, 0, 10, 6, 100, 97, 116, 97]);
		parser._write(buf, null, cb);

		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith();

		expect(onData).toHaveBeenCalledTimes(1);
		expect(onData).toHaveBeenCalledWith(P.PACKET_GOSSIP_REQ, expect.any(Buffer));
		const data = onData.mock.calls[0][1];
		expect(data.toString()).toBe("data");

		expect(parser.buf).toBeNull();
	});

	it("should multiple emit data with valid chunks & store rest chunk", () => {
		const cb = mock.fn();
		onData.mockClear();

		const buf = Buffer.from(
			[13, 0, 0, 0, 11, 6, 100, 97, 116, 97, 49].concat(
				[12, 0, 0, 0, 11, 7, 100, 97, 116, 97, 50],
				[13, 0, 0, 0, 11, 6, 100, 97]
			)
		);
		parser._write(buf, null, cb);

		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith();

		expect(onData).toHaveBeenCalledTimes(2);
		expect(onData).toHaveBeenCalledWith(P.PACKET_GOSSIP_REQ, expect.any(Buffer));
		let data = onData.mock.calls[0][1];
		expect(data.toString()).toBe("data1");

		expect(onData).toHaveBeenCalledWith(P.PACKET_GOSSIP_RES, expect.any(Buffer));
		data = onData.mock.calls[1][1];
		expect(data.toString()).toBe("data2");

		expect(parser.buf).toBeInstanceOf(Buffer);
		expect(parser.buf).toEqual(Buffer.from([13, 0, 0, 0, 11, 6, 100, 97]));
	});
});
