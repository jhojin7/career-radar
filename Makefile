.PHONY: setup dev check test build start

setup:
	pnpm install

dev:
	pnpm dev

check:
	pnpm lint
	pnpm typecheck
	pnpm test
	pnpm build

test:
	pnpm test

build:
	pnpm build

start:
	pnpm start
