#!/bin/sh

./node_modules/.bin/rethink-migrate up --db send2pocket --host $RETHINKDB_HOST && ./node_modules/.bin/ts-node index.ts
