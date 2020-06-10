export default `
Usage:
    air [command] [flag]
Commands:
    serve           start air http server
    lint            eslint js
    gitlint         lint used for git hook
    compress        compress less or javascript files
    install         install git hooks
    template        use art-template render html
    
Flags:
    -v              show air version
    -h              show this help information
    -p              set server listen port
    -d              document root , work dir, install dir
    -o              set output file path for air template
    --debug         compress with debug mode
    --clean         compress with clean mode,remove console debugger
    --escape        escape when use art-template
    --pretty        pretty and lint-fixable-only for gitlint and lint
    --lintlast      do pretty first and then do eslint
    --nogit         do not integrate with git for gitlint
    --dry           just run as a static server
    --art           use art-template instead of ssi
`;

export const version = '0.7.0';

export const templatetips = `
Usage:
    air template filename.html [flag]

Flags:
    -o              set output file path for air template
    -d              work dir for air template
    --debug         compress with debug mode
    --escape        escape when use template
    --art           use art-template instead of ssi

`;
