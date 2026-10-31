// Starts the backup service. Settings come from environment variables (see server/README.md).

import { createServer } from "node:http";
import { createHandler } from "./app.ts";
import { createBackupStore } from "./backupStore.ts";

const env = process.env;
const token = env.BACKUP_TOKEN ?? "";
if (token.length < 20) {
  console.error("BACKUP_TOKEN must be set to a secret of at least 20 characters.");
  process.exit(1);
}

const port = Number(env.PORT ?? 8095);
const host = env.HOST ?? "127.0.0.1";
const folder = env.DATA_DIR ?? "./data";
const keep = Number(env.KEEP ?? 30);
const handler = createHandler(
  {
    token,
    allowedOrigin: env.ALLOWED_ORIGIN ?? "https://totalsinnlos.github.io",
    maxBytes: Number(env.MAX_BYTES ?? 10_000_000),
  },
  createBackupStore(folder, keep),
);

const server = createServer(async (request, response) => {
  await handler(request, response);
  console.log(`${new Date().toISOString()} ${request.method} ${request.url} ${response.statusCode}`);
});
server.listen(port, host, () => console.log(`Backup service on ${host}:${port}, keeping ${keep} backups in ${folder}`));

// Docker stops containers with SIGTERM; without this, Node would ignore it and Docker would wait 10 s.
process.on("SIGTERM", () => server.close(() => process.exit(0)));
