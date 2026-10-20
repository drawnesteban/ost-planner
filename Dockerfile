FROM node:22-alpine
WORKDIR /app
COPY server/ ./
COPY public/ ./public/
ENV PORT=1820 DATA_ROOT=/data
EXPOSE 1820
CMD ["node", "server.js"]
