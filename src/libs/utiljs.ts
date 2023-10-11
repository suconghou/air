export default {
	isFunction(value: any) {
		return typeof value === 'function';
	},
	isObject(value: any) {
		return value && typeof value === 'object' && value.constructor === Object;
	},
	unique(arr: any) {
		return Array.from(new Set(arr));
	},
	getParams(args: Array<string>) {
		const kMap = {
			'-v': 'version',
			'-p': 'port',
			'-o': 'output',
			'-d': 'dir',
			'-q': 'query',
			'-m': 'modifyVars',
			'--escape': 'escape',
			'--debug': 'debug',
			'--clean': 'clean',
			'--dry': 'dry',
			'--cors': 'cors',
			'--art': 'art',
			'--nogit': 'nogit',
			'--lintlast': 'lintlast',
		};
		return this.params(args, kMap);
	},
	params(args: Array<string>, kMap: Record<string, any>) {
		const ret = {};
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
