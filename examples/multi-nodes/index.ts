import cluster from "cluster";

process.env.TRANSPORTER = "Redis";
process.env.DISCOVERER = "Redis";
//process.env.DISCOVERER_SERIALIZER = "MsgPack";
process.env.NODE_COUNT = "2";

if (cluster.isMaster) {
	cluster.setupMaster({
		serialization: "json"
	});
	require("./master.ts");
} else {
	require("./node.ts");
}
