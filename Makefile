build:
	npx esbuild src/index.ts --bundle --platform=node --format=cjs --target=node18 \
		--banner:js='#!/usr/bin/env node' --outfile=air
	chmod +x air

check:
	npx tsc --noEmit

clean:
	rm -f air
