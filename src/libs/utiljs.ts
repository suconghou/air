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
			'--debug': 'debug',
			'--clean': 'clean',
			'--dry': 'dry',
			'--cors': 'cors',
			'--help': 'help',
		};
		const ret: Record<string, any> = {};
		const keys = Object.keys(kMap);
		let key: string | null;
		args.forEach((item) => {
			if (keys.includes(item)) {
				if (item.substr(0, 2) == '--') {
					ret[kMap[item]] = true;
				} else {
					key = kMap[item];
				}
			} else if (key && item.toString().charAt(0) != '-') {
				ret[key] = item;
				key = null;
			} else {
				key = null;
			}
		});
		return ret;
	},
};
