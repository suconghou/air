import path from 'path';
import child_process from 'child_process';
import fs from 'fs';

const spawnSync = child_process.spawnSync;
const prettyTypes = ['js', 'vue', 'jsx', 'json', 'css', 'less', 'ts', 'md'];
const esTypes = ['js', 'jsx', 'vue'];

const configDir = 'config';

const exit = code => process.exit(code);

export default class lint {
	constructor(cwd, files) {
		this.cwd = cwd;
		if (Array.isArray(files) && files.length > 0) {
			this.prettierrc = path.join(this.cwd, configDir, '.prettierrc');
			this.eslintrc = path.join(this.cwd, configDir, '.eslintrc.js');
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
	lint() {
		if (!(this.prettierrc && this.eslintrc)) {
			return;
		}
		try {
			fs.accessSync(this.prettierrc, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}
		try {
			fs.accessSync(this.eslintrc, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}
		for (let i = 0, j = this.files.length; i < j; i++) {
			const { path, type, name } = this.files[i];

			fs.access(path, fs.constants.R_OK | fs.constants.W_OK, err => {
				if (err) {
					console.error(err.toString());
					exit(1);
					return;
				}
				this.dolint(path, type.toLowerCase(), name);
			});
		}
	}

	dolint(path, type, name) {
		if (prettyTypes.includes(type)) {
			const r1 = this.prettier(path);
			if (r1.status !== 0) {
				exit(r1.status);
			}
		}

		if (esTypes.includes(type)) {
			const r2 = this.eslint(path);
			if (r2.status !== 0) {
				exit(r2.status);
			}
		}
		this.gitadd(path);
	}

	eslint(f) {
		return spawnSync('eslint', ['-c', this.eslintrc, '--fix', f], { stdio: 'inherit' });
	}
	prettier(f) {
		return spawnSync('prettier', ['-c', this.prettierrc, '--write', f], { stdio: 'inherit' });
	}
	gitadd(f) {
		return spawnSync('git', ['add', f], { stdio: 'inherit' });
	}
	install() {
		const git = '.git';
		const hooks = 'hooks';
		const precommit = 'pre-commit';
		const postcommit = 'post-commit';
		const prehook = path.join(this.cwd, configDir, precommit);
		const posthook = path.join(this.cwd, configDir, postcommit);

		const dst = path.join(this.cwd, git, hooks, precommit);
		const postdst = path.join(this.cwd, git, hooks, postcommit);

		try {
			fs.accessSync(prehook, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}
		fs.copyFileSync(prehook, dst);
		try {
			fs.accessSync(posthook, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(err.toString());
			exit(1);
		}
		fs.copyFileSync(posthook, postdst);
		const mode = 0o755;
		fs.chmodSync(dst, mode);
		fs.chmodSync(postdst, mode);
	}
}
