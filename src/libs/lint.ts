import * as process from 'process';
import * as path from 'path';
import { promisify } from 'util';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { fsAccess, fsCopyFile, fsChmod, fsStat, fsReadFile } from './util';
import { cliArgs } from '../types';

const spawn = promisify(child_process.spawn);
const spawnSync = child_process.spawnSync;

const prettyTypes = ['js', 'vue', 'jsx', 'json', 'css', 'less', 'ts', 'md'];
const esTypes = ['js', 'jsx', 'vue'];

const defaultFormat = '--no-config --tab-width 4 --use-tabs true --print-width 120 --single-quote true --write';

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

export default class lint {

    private prettierrc = '';
    private eslintrc = '';
    private files = [];

    constructor(private cwd: string, files: Array<string>, private opts: cliArgs) {

        const dir = path.isAbsolute(opts.dir) ? '' : cwd;
        this.prettierrc = path.join(dir, opts.dir, options.prettierrc);
        this.eslintrc = path.join(dir, opts.dir, options.eslintrc);

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
        const res = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACM']);
        const arrs = res.stdout
            .toString()
            .split('\n')
            .filter(v => v);
        if (arrs.length) {
            this.files = this.parse(arrs);
        }
    }

    private parse(files: Array<string>) {
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
    public async lint() {
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
            await this.checkfiles();
            try {
                await fsAccess(this.prettierrc, stat);
            } catch (e) {
                // 不使用配置文件,使用內建配置
                this.prettierrc = '';
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
            console.error(err);
            process.exit(1);
        }
    }

    private dolint(esfiles: Array<string>, prefiles: Array<string>) {
        if (this.opts.noprettier !== true) {
            const r1 = this.prettier(prefiles);
            if (r1 && r1.status !== 0) {
                throw r1;
            }
        }
        if (this.opts.noeslint !== true) {
            const r2 = this.eslint(esfiles);
            if (r2 && r2.status !== 0) {
                throw r2;
            }
        }
    }

    private eslint(f: Array<string>) {
        if (f && f.length) {
            return spawnSync('eslint', ['-c', this.eslintrc, '--fix', f.join(' ')], spawnOps as any);
        }
    }
    private prettier(f: Array<string>) {
        if (f && f.length) {
            const config = this.prettierrc
                ? ['--config', this.prettierrc, '--write', f.join(' ')]
                : [defaultFormat, f.join(' ')];
            return spawnSync('prettier', config, spawnOps as any);
        }
    }
    private gitadd(f: Array<string>) {
        if (f && f.length) {
            return spawn('git', ['add', '-u', f.join(' ')], spawnOps as any);
        }
        return Promise.resolve();
    }
    public async install() {
        const { dir, git, hooks, precommit, postcommit, commitmsg } = Object.assign({}, options, this.opts);
        const cwd = path.isAbsolute(dir) ? '' : this.cwd;

        const prehook = path.join(cwd, dir, precommit);
        const posthook = path.join(cwd, dir, postcommit);
        const msghook = path.join(cwd, dir, commitmsg);

        const predst = path.join(this.cwd, git, hooks, precommit);
        const postdst = path.join(this.cwd, git, hooks, postcommit);
        const msgdst = path.join(this.cwd, git, hooks, commitmsg);

        const mode = 0o755;
        await Promise.all([fsAccess(prehook, stat), fsAccess(posthook, stat), fsAccess(msghook, stat)]);
        await Promise.all([
            fsCopyFile(prehook, predst),
            fsCopyFile(posthook, postdst),
            fsCopyFile(msghook, msgdst)
        ]);
        await Promise.all([fsChmod(predst, mode), fsChmod(postdst, mode), fsChmod(msgdst, mode)]);
    }

    private async checkfiles() {
        const maxsize = 1048576;
        // 检查文件大小,超过1MB禁止提交
        const stats = await Promise.all(
            this.files.map(item => {
                return fsStat(item.path);
            })
        );
        return stats.every((item, index) => {
            if (item.size > maxsize) {
                throw new Error(`${this.files[index].path} too large,${item.size} exceed ${maxsize}`);
            }
            return true;
        });
    }


    static async commitlint(commitfile: string) {
        const str = await fsReadFile(commitfile);
        const msg = str.toString();
        if (/Merge\s+branch/i.test(msg)) {
            return;
        }
        if (
            !/(build|ci|docs|feat|fix|perf|refactor|style|test|revert|chore).{0,2}(\(.{1,100}\))?.{0,2}:.{1,200}/.test(
                msg
            )
        ) {
            console.info('commit message should be format like <type>(optional scope): <description>');
            process.exit(1);
        }
    }

}
