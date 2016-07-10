FROM risingstack/alpine:3.3-v6.2.0-3.6.0

RUN apk update && apk add make g++

RUN mkdir /app
COPY . /app
WORKDIR /app
RUN npm install
RUN npm run prepublish

ENV NODE_ENV=production
CMD ["sh", "-c", "./node_modules/.bin/ts-node index.ts"]
