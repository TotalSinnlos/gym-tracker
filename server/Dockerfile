# The backup service and AI trainer. No packages to install: Node runs the TypeScript files directly.
FROM node:24-alpine
WORKDIR /app
COPY app.ts backupStore.ts gemini.ts main.ts trainer.ts trainerInstructions.ts ./
ENV HOST=0.0.0.0 PORT=8095 DATA_DIR=/data NODE_ENV=production
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8095
CMD ["node", "main.ts"]
