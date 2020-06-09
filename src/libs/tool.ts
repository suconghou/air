const maxItem = 1e3;
const caches = new Map();
export default class {
	private static errorlog = [];

	static log(msg: any) {
		msg = msg.toString();
		if (this.errorlog.length > maxItem) {
			this.errorlog = [];
		}
		var nowDate = new Date();
		msg = nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString() + ' ' + msg;
		this.errorlog.push(msg);
		console.log(msg);
	}

	static get(k: string) {
		return caches.get(k);
	}

	static set(k: string, v: any) {
		return caches.set(k, v);
	}
}
