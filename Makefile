DOCKER_COMPOSE = docker-compose

.phony: compile
compile: install
	${DOCKER_COMPOSE} run --rm node node_modules/.bin/ncc build index.js

.phony: format
format:
	${DOCKER_COMPOSE} run --rm node npm run format

.phony: lint
lint:
	${DOCKER_COMPOSE} run --rm node npm run lint

.phony: install
install:
	${DOCKER_COMPOSE} run --rm node npm install
