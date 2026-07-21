FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Make entrypoint executable
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
