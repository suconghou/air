import process from 'process';
import path from 'path';
import util from 'util';
import child_process from 'child_process';
import fs from 'fs';
import utilnode, { fsAccess, fsCopyFile, fsChmod } from './util.js';
import utiljs from './utiljs.js';

const spawn = util.promisify(child_process.spawn);

const prettyTypes = ['js', 'vue', 'jsx', 'json', 'css', 'less', 'ts', 'md'];
const esTypes = ['js', 'jsx', 'vue'];

const configDir = 'config';
const defDir = 'config';

const options = {
	dir: 'config',
	git: '.git',
	hooks: 'hooks',
	precommit: 'pre-commit',
	postcommit: 'post-commit',
	prettierrc: '.prettierrc',
	eslintrc: '.eslintrc.js'
};
const stat = fs.constants.R_OK | fs.constants.W_OK;

const spawnOps = { stdio: 'ignore', shell: true, detached: true };

const exit = code => process.exit(code);

export default class lint {
	constructor(cwd, files) {
		this.cwd = cwd;
		this.args = [...files];
		if (Array.isArray(files) && files.length > 0) {
			const opts = utiljs.params(this.args, { '-dir': 'dir' });
			const { dir, prettierrc, eslintrc } = Object.assign({}, options, opts);
			this.prettierrc = path.join(this.cwd, dir, prettierrc);
			this.eslintrc = path.join(this.cwd, dir, eslintrc);
			const index = files.findIndex(item => item == '-dir');
			if (index >= 0) {
				const len = opts.dir ? 2 : 1;
				files.splice(index, len);
			}
			this.files = this.parse(files);
		}
	}
	parse(files) {
		return files.map(item => {
			const name = item.trim();
			const type = item.split('.').pop();
			let p = name;
			if (!path.isAbsolute(name)) {
				p = path.join(this.cwd, name);
			}
			return { name, path: p, type };
		});
	}
	async lint() {
		if (!(this.prettierrc && this.eslintrc)) {
			return;
		}

		try {
			await Promise.all([fsAccess(this.prettierrc, stat), fsAccess(this.eslintrc, stat)]);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}

		const tasks = this.files.map(item => {
			const { path, type, name } = item;
			return new Promise(async (resolve, reject) => {
				try {
					await fsAccess(path, stat);
					const [r1, r2] = await this.dolint(path, type, name);
					console.info(r1, r2);
					// resolve([r1, r2]);
				} catch (e) {
					reject(e);
				}
			});
		});

		try {
			// const res = await Promise.all(tasks);
			// console.info(res);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}
	}

	sleep() {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve();
			}, 1200);
		});
	}

	async dolint(path, type, name) {
		let r1, r2;
		if (prettyTypes.includes(type)) {
			r1 = await this.prettier(path);
		}

		if (esTypes.includes(type)) {
			r2 = await this.eslint(path);
		}
		await this.gitadd(path);
		return [r1, r2];
	}

	eslint(f) {
		return spawn('eslint', ['-c', this.eslintrc, '--fix', f], spawnOps);
	}
	prettier(f) {
		return spawn('prettier', ['-c', this.prettierrc, '--write', f], spawnOps);
	}
	gitadd(f) {
		return spawn('git', ['add', f], spawnOps);
	}
	async install() {
		const opts = utiljs.params(this.args, { '-dir': 'dir' });
		const { dir, git, hooks, precommit, postcommit } = Object.assign({}, options, opts);

		const prehook = path.join(this.cwd, dir, precommit);
		const posthook = path.join(this.cwd, dir, postcommit);

		const predst = path.join(this.cwd, git, hooks, precommit);
		const postdst = path.join(this.cwd, git, hooks, postcommit);

		const mode = 0o755;
		try {
			await Promise.all([fsAccess(prehook, stat), fsAccess(posthook, stat)]);
			await Promise.all([fsCopyFile(prehook, predst), fsCopyFile(posthook, postdst)]);
			await Promise.all([fsChmod(predst, mode), fsChmod(postdst, mode)]);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}
	}
}
