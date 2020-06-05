import * as process from 'process';
import * as path from 'path';
import { promisify } from 'util';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { fsAccess, fsCopyFile, fsChmod, fsStat, fsReadFile, fsWriteFile } from './util';
import { cliArgs } from '../types';

const spawn = promisify(child_process.spawn);
const spawnSync = child_process.spawnSync;

const prettyTypes = ['js', 'vue', 'jsx', 'ts', 'css', 'less', 'html', 'json', 'scss', 'md'];

const extParser = {
    'js': 'babel',
    'jsx': 'babel',
    'ts': 'typescript',
    'vue': 'vue',
    'html': 'html',
    'css': 'css',
    'less': 'less',
    'scss': 'scss',
    'json': 'json',
    'md': 'mdx',
    'yaml': 'yaml'
}

const config = {
    eslintConfig: {
        parserOptions: {
            ecmaVersion: 7
        },
        rules: {
            semi: ["error", "never"]
        }
    },
    prettierOptions: {
        printWidth: 120,
        tabWidth: 4,
        singleQuote: true,
        useTabs: true,
        parser: 'babel',
    },
    fallbackPrettierOptions: {
        printWidth: 120,
        tabWidth: 4,
        singleQuote: true,
        useTabs: true,
        parser: 'babel',
    },
    prettierLast: true,

}

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
        this.files = files.filter(item => item.charAt(0) != '-');
    }

    async gitlint() {
        const res = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACM']);
        const arrs = res.stdout
            .toString()
            .split('\n')
            .filter(v => v);

        if (!arrs.length) {
            return;
        }
        const { prefiles, gitfiles } = this.parse(arrs);
        await this.dolint(prefiles, gitfiles);
    }

    private parse(files: Array<string>) {
        const prefiles = [];
        const gitfiles = [];
        const filetypes = files.map(item => {
            const name = item.trim();
            const type = item.split('.').pop();
            let p = name;
            if (!path.isAbsolute(name)) {
                p = path.join(this.cwd, name);
            }
            if (prettyTypes.includes(type)) {
                prefiles.push(p);
            }
            gitfiles.push(p);
            return { name, path: p, type };
        });
        return { prefiles, gitfiles, filetypes };
    }

    public async lint() {
        if (!(this.prettierrc && this.eslintrc)) {
            return;
        }
        if (!this.files || !this.files.length) {
            return;
        }
        let esfiles = [],
            prefiles = [],
            gitfiles = [];
        // await this.checkfiles();
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
                gitfiles.push(path);
                return fsAccess(path, stat);
            })
        );
        // this.dolint(esfiles, prefiles);
        if (!this.opts.lintonly) {
            await this.gitadd(gitfiles);
        }
    }

    private async dolint(prefiles: Array<string>, gitfiles: Array<string>) {
        await this.checkfiles(gitfiles);
        console.info(prefiles)
        const r = await Promise.all(this.lintConfig(prefiles))
        console.info(r)

    }

    private lintConfig(prefiles: Array<string>) {
        const format = require("prettier-eslint");
        return prefiles.map(item => {
            return new Promise(async (resolve, reject) => {
                try {
                    const r = await fsReadFile(item, 'utf-8')
                    const options = {
                        ...config,
                        ...{
                            text: r
                        }
                    }
                    options.prettierOptions.parser = this.getParser(item);
                    const res = format(options)
                    console.info(res)
                    resolve(res)
                    await fsWriteFile(item, res)
                } catch (e) {
                    reject(e)
                }
            })
        });
    }

    private getParser(file: string) {
        const ext = file.split('.').pop().toLowerCase()
        return extParser[ext] ? extParser[ext] : 'babel';
    }

    private eslint(f: Array<string>) {
        if (f && f.length) {
            return spawnSync('eslint', ['-c', this.eslintrc, '--fix', f.join(' ')], spawnOps as any);
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
        await Promise.all([fsCopyFile(prehook, predst), fsCopyFile(posthook, postdst), fsCopyFile(msghook, msgdst)]);
        await Promise.all([fsChmod(predst, mode), fsChmod(postdst, mode), fsChmod(msgdst, mode)]);
    }

    private async checkfiles(files: Array<string>) {
        const maxsize = 1048576;
        // 检查文件大小,超过1MB禁止提交
        const stats = await Promise.all(files.map(item => fsStat(item)));
        return stats.every((item, index) => {
            if (item.size > maxsize) {
                throw new Error(`${files[index]} too large,${item.size} exceed ${maxsize}`);
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