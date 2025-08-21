FROM node:20-alpine AS base
WORKDIR /usr/src/app

FROM base AS dev
RUN npm i -g pnpm@9
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm","dev"]

FROM base AS prod
RUN npm i -g pnpm@9
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["node","src/index.js"]