FROM node:24-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 10000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
