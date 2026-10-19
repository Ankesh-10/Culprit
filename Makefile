.PHONY: test

test:
	npm run typecheck
	npm test
	npm run build
