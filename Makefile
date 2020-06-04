dev:
	make ts && \
	cd src && \
	rollup index.js -o ../bundle.js -f cjs -e net,fs,os,process,path,child_process,util,http,querystring && \
	cd .. && \
	echo '#!/usr/bin/env node' | cat - bundle.js > air && chmod +x air
ts:
	cd src && \
	tsc -m es6 -t ES2019 index.ts
