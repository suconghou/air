import os from 'os';
import process from 'process';
import path from 'path';
import util from 'util';
import child_process from 'child_process';
import fs from 'fs';
import { fsAccess, fsCopyFile, fsChmod, fsReadFile } from './util.js';
import utiljs from './utiljs.js';

const spawn = util.promisify(child_process.spawn);
const spawnSync = child_process.spawnSync;

const prettyTypes = ['js', 'vue', 'jsx', 'json', 'css', 'less', 'ts', 'md'];
const esTypes = ['js', 'jsx', 'vue'];

const defaultFormat = `--no-config --tab-width 4 --use-tabs true --print-width 120 --single-quote true --write`;

const options = {
    dir: 'config',
    git: '.git',
    hooks: 'hooks',
    precommit: 'pre-commit',
    postcommit: 'post-commit',
    commitmsg: 'commit-msg',
    prettierrc: '.prettierrc',
    eslintrc: '.eslintrc.js'
};
const stat = fs.constants.R_OK | fs.constants.W_OK;

const spawnOps = { stdio: 'inherit', shell: true };

const exit = code => process.exit(code);

export default class lint {
    constructor(cwd, files) {
        this.cwd = cwd;
        const opts = utiljs.params(files, {
            '-dir': 'dir',
            '--lint': 'lintonly',
            '--noprettier': 'noprettier',
            '--noeslint': 'noeslint'
        });
        this.opts = Object.assign({}, options, opts);
        const { dir, prettierrc, eslintrc } = this.opts;
        const distcwd = path.isAbsolute(dir) ? '' : this.cwd;
        this.prettierrc = path.join(distcwd, dir, prettierrc);
        this.eslintrc = path.join(distcwd, dir, eslintrc);

        if (Array.isArray(files) && files.length > 0) {
            const index1 = files.findIndex(item => item == '-dir');
            if (index1 >= 0) {
                const len = opts.dir ? 2 : 1;
                files.splice(index1, len);
            }
            files = files.filter(item => {
                return item.substr(0, 2) !== '--';
            });
            if (!files.length) {
                this.doautoLint();
                return;
            }
            this.files = this.parse(files);
        } else {
            this.opts.lintonly = true;
            this.doautoLint();
        }
    }
    async doautoLint() {
        try {
            const res = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACM']);
            const arrs = res.stdout
                .toString()
                .split(os.EOL)
                .filter(v => v);
            if (arrs.length) {
                this.files = this.parse(arrs);
            }
        } catch (err) {
            console.error(err.toString());
            exit(1);
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
        if (!this.files || !this.files.length) {
            return;
        }

        try {
            let esfiles = [],
                prefiles = [],
                gitfiles = [];

            try {
                await fsAccess(this.prettierrc, stat)
            } catch{
                // 不使用配置文件,使用內建配置
                this.prettierrc = ''
            }

            await fsAccess(this.eslintrc, stat);
            await Promise.all(
                this.files.map(item => {
                    const { path, type, name } = item;
                    if (prettyTypes.includes(type)) {
                        prefiles.push(path);
                    }
                    if (esTypes.includes(type)) {
                        esfiles.push(path);
                    }
                    gitfiles.push(path);
                    return fsAccess(path, stat);
                })
            );
            this.dolint(esfiles, prefiles);
            if (!this.opts.lintonly) {
                await this.gitadd(gitfiles);
            }
        } catch (err) {
            const str = err.toString();
            if (str.length > 5) {
                console.error(str);
            }
            exit(1);
        }
    }

    dolint(esfiles, prefiles) {
        if (this.opts.noprettier !== true) {
            const r1 = this.prettier(prefiles);
            if (r1 && r1.status !== 0) {
                throw new Error(r1);
            }
        }
        if (this.opts.noeslint !== true) {
            const r2 = this.eslint(esfiles);
            if (r2 && r2.status !== 0) {
                throw new Error(r2);
            }
        }
    }

    eslint(f) {
        if (f && f.length) {
            return spawnSync('eslint', ['-c', this.eslintrc, '--fix', f.join(' ')], spawnOps);
        }
    }
    prettier(f) {
        if (f && f.length) {
            const config = this.prettierrc ? ['--config', this.prettierrc, '--write', f.join(' ')] : [defaultFormat, f.join(' ')];
            return spawnSync('prettier', config, spawnOps);
        }
    }
    gitadd(f) {
        if (f && f.length) {
            return spawn('git', ['add', '-u', f.join(' ')], spawnOps);
        }
        return Promise.resolve();
    }
    async install() {
        const { dir, git, hooks, precommit, postcommit, commitmsg } = Object.assign({}, options, this.opts);
        const cwd = path.isAbsolute(dir) ? '' : this.cwd;

        const prehook = path.join(cwd, dir, precommit);
        const posthook = path.join(cwd, dir, postcommit);
        const msghook = path.join(cwd, dir, commitmsg);

        const predst = path.join(this.cwd, git, hooks, precommit);
        const postdst = path.join(this.cwd, git, hooks, postcommit);
        const msgdst = path.join(this.cwd, git, hooks, commitmsg);

        const mode = 0o755;
        try {
            await Promise.all([fsAccess(prehook, stat), fsAccess(posthook, stat), fsAccess(msghook, stat)]);
            await Promise.all([
                fsCopyFile(prehook, predst),
                fsCopyFile(posthook, postdst),
                fsCopyFile(msghook, msgdst)
            ]);
            await Promise.all([fsChmod(predst, mode), fsChmod(postdst, mode), fsChmod(msgdst, mode)]);
        } catch (err) {
            console.error(err.toString());
            exit(1);
        }
    }
}
