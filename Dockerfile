FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
# state.json persists across restarts only if /data is a mounted volume:
#   set STATE_FILE=/data/state.json and mount a volume at /data
CMD ["node", "src/index.js"]
