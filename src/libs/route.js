import compress from './compress.js';
import ssi from './ssi.js';

const POST = {
	reload(request, response, args, query) {}
};

const GET = {
	reload(request, response, args, query) {}
};

const routers = {
	POST,
	GET
};

const regxpPath = [
	{
		reg: /[\w\-/]+\.css$/,
		handler: compress.compressLessReq.bind(compress)
	},
	{
		reg: /[\w\-/]+\.js$/,
		handler: compress.compressJsReg.bind(compress)
	},
	{
		reg: /[\w\-/]+\.html$/,
		handler: ssi.load.bind(ssi)
	}
];

const regRouters = {
	GET: regxpPath
};

export default {
	getRouter(m) {
		if (routers[m]) {
			return routers[m];
		}
	},
	getRegxpRouter(m, pathinfo) {
		let routers;
		if (regRouters[m]) {
			routers = regRouters[m];
		}
		if (!routers) {
			return;
		}
		for (let i = 0, j = routers.length; i < j; i++) {
			const item = routers[i];
			if (item.reg.test(pathinfo)) {
				return {
					...item,
					matches: pathinfo.match(item.reg)
				};
			}
		}
	}
};
