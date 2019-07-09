export default `
Usage:
    air [command] [flag]
Commands:
    serve           start air http server
    lint            eslint js
    compress        compress less or javascript files
    install         install git hooks
    template        use art-template render html
    
Flags:
    -v              show air version
    -h              show this help information
    -p              set server listen port
    -d              set server document root
    -dir            set lint or install config path
    --debug         compress with debug mode
    --clean         compress with clean mode,remove console debugger
    --escape        escape when use template
    --dry           just run as a static server
    --art           use art-template not ssi
    --lint          lint only,useful for air lint
    --noprettier    for air lint & air gitlint , do not run prettier task
    --noeslint      for air lint & air gitlint , do not run eslint task
`;

export const version = '0.6.32';
