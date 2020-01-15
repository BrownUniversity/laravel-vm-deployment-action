.phony: compile
compile: install
	docker-compose run --rm node node_modules/.bin/ncc build index.js

.phony: install
install:
	docker-compose run --rm node npm install
