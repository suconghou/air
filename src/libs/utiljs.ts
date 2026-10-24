export default {
	isFunction(value: any) {
		return typeof value === 'function';
	},
	getParams(args: Array<string>) {
		const kMap: Record<string, string> = {
			'-v': 'version',
			'-p': 'port',
			'-d': 'dir',
			'-q': 'query',
			'-m': 'modifyVars',
			'--proxy': 'proxy',
			'--debug': 'debug',
			'--clean': 'clean',
			'--dry': 'dry',
			'--cors': 'cors',
			'--help': 'help',
		};
		// 这些旗标需要取值且可重复出现, 收集为数组
		const multi: Record<string, boolean> = { proxy: true };
		const ret: Record<string, any> = {};
		const keys = Object.keys(kMap);
		let key: string | null;
		args.forEach((item) => {
			if (keys.includes(item)) {
				if (item.charAt(0) == '-' && item.charAt(1) == '-' && !multi[kMap[item]]) {
					ret[kMap[item]] = true;
				} else {
					key = kMap[item];
				}
			} else if (key && item.charAt(0) != '-') {
				if (multi[key]) {
					if (!Array.isArray(ret[key])) {
						ret[key] = [];
					}
					ret[key].push(item);
				} else {
					ret[key] = item;
				}
				key = null;
			} else {
				key = null;
			}
		});
		return ret;
	},
};
