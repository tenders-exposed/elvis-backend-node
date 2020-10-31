FROM node:9.2.0

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install deps
RUN npm install --only=production
RUN npm install -g pm2

COPY . ./

ENV HOST 0.0.0.0
ENV PORT 10010

EXPOSE $PORT
CMD [ "pm2-runtime", "--name", "api", "--raw", "--only", "API", "server.js" ]
