const types = require("types.json");

console.info(types);

const typesMap = {};

const defaultMime = "application/octet-stream";

export default {
	lookup(filePath) {
		const t = filePath.split(".").pop();
		const type = typesMap[t];
		return type ? type : defaultMime;
	}
};
