const maxItem = 1e3;
const caches = new Map();
export default class default_1 {
	static log(msg) {
		msg = msg.toString();
		if (this.errorlog.length > maxItem) {
			this.errorlog = [];
		}
		var nowDate = new Date();
		msg = nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString() + ' ' + msg;
		this.errorlog.push(msg);
		console.log(msg);
	}
	static get(k) {
		return caches.get(k);
	}
	static set(k, v) {
		return caches.set(k, v);
	}
}
default_1.errorlog = [];
