FROM node:18-alpine

WORKDIR /usr/src/app

# Clone Pipedream components
RUN apk add --no-cache git \
  && git clone https://github.com/PipedreamHQ/pipedream.git pipedream-components

COPY package*.json ./
RUN npm install --production

COPY . .

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
EXPOSE 3000

CMD ["node", "src/index.js"]

