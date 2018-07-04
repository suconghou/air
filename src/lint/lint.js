import path from "path";
import child_process from "child_process";
import fs from "fs";

const spawnSync = child_process.spawnSync;
const prettyTypes = ["js", "vue", "jsx", "json", "css", "less", "ts", "md"];
const esTypes = ["js", "jsx", "vue"];

const exit = code => process.exit(code);

export default class lint {
	constructor(node, files) {
		if (Array.isArray(files)) {
			const [c, ...f] = files;
			this.node = node;
			this.c = c;
			this.cwd = process.cwd();
			this.prettierrc = path.join(this.cwd, "config", ".prettierrc");
			this.eslintrc = path.join(this.cwd, "config", ".eslintrc.js");
			if (files[1] == "install") {
				return this.install();
			}
			if (Array.isArray(f) && f.length > 0) {
				this.files = this.parse(f);
			}
		}
		if (Array.isArray(this.files) && this.files.length > 0) {
			this.lint();
		}
	}
	parse(files) {
		return files.map(item => {
			const name = item.trim();
			const type = item.split(".").pop();
			let p = name;
			if (!path.isAbsolute(name)) {
				p = path.join(this.cwd, name);
			}
			return { name, path: p, type };
		});
	}
	lint() {
		try {
			fs.accessSync(this.prettierrc, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(`${this.prettierrc} Not Exist`);
			exit(1);
		}
		try {
			fs.accessSync(this.eslintrc, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(`${this.eslintrc} Not Exist`);
			exit(1);
		}
		for (let i = 0, j = this.files.length; i < j; i++) {
			const { path, type, name } = this.files[i];

			fs.access(path, fs.constants.R_OK | fs.constants.W_OK, err => {
				if (err) {
					console.error(`${path} Not Exist`);
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
		return spawnSync("eslint", ["-c", this.eslintrc, "--fix", f], { stdio: "inherit" });
	}
	prettier(f) {
		return spawnSync("prettier", ["-c", this.prettierrc, "--write", f], { stdio: "inherit" });
	}
	gitadd(f) {
		return spawnSync("git", ["add", f], { stdio: "inherit" });
	}
	install() {
		const prehook = path.join(this.cwd, "config", "pre-commit");
		const posthook = path.join(this.cwd, "config", "post-commit");

		const dst = path.join(this.cwd, ".git", "pre-commit");
		const postdst = path.join(this.cwd, ".git", "post-commit");
		try {
			fs.accessSync(prehook, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(`${prehook} Not Exist`);
			exit(1);
		}
		fs.copyFileSync(prehook, dst);
		try {
			fs.accessSync(posthook, fs.constants.R_OK | fs.constants.W_OK);
		} catch (err) {
			console.error(`${posthook} Not Exist`);
			exit(1);
		}
		fs.copyFileSync(posthook, postdst);
		const mode = 7;
		fs.chmodSync(prehook, mode);
		fs.chmodSync(posthook, mode);
	}
}
