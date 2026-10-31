// Starts the backup service. Settings come from environment variables (see server/README.md).

import { createServer } from "node:http";
import { createHandler } from "./app.ts";
import { createBackupStore } from "./backupStore.ts";
import { createGeminiWriter } from "./gemini.ts";
import type { TrainerConfig } from "./trainer.ts";
import { trainerInstructions } from "./trainerInstructions.ts";

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
const model = env.AI_MODEL ?? "gemini-3.6-flash";
const trainer = setUpTrainer();
const handler = createHandler(
  {
    token,
    allowedOrigin: env.ALLOWED_ORIGIN ?? "https://totalsinnlos.github.io",
    maxBytes: Number(env.MAX_BYTES ?? 10_000_000),
    trainer,
  },
  createBackupStore(folder, keep),
);

const server = createServer(async (request, response) => {
  await handler(request, response);
  console.log(`${new Date().toISOString()} ${request.method} ${request.url} ${response.statusCode}`);
});
server.listen(port, host, () => {
  console.log(`Backup service on ${host}:${port}, keeping ${keep} backups in ${folder}`);
  console.log(trainer ? `Trainer on, using ${env.AI_PROVIDER ?? "gemini"} model ${model}` : "Trainer off (no AI_API_KEY)");
});

// Docker stops containers with SIGTERM; without this, Node would ignore it and Docker would wait 10 s.
process.on("SIGTERM", () => server.close(() => process.exit(0)));

/** The trainer's settings, or undefined (trainer off) when there's no AI key. */
function setUpTrainer(): TrainerConfig | undefined {
  const apiKey = env.AI_API_KEY ?? "";
  if (!apiKey) return undefined;
  const provider = env.AI_PROVIDER ?? "gemini";
  if (provider !== "gemini") {
    console.error(`AI_PROVIDER "${provider}" isn't supported. The only one so far is "gemini".`);
    process.exit(1);
  }
  return {
    writer: createGeminiWriter({ apiKey, model }),
    instructions: trainerInstructions,
    maxChars: Number(env.TRAINER_MAX_CHARS ?? 600_000),
    timeoutMs: Number(env.TRAINER_TIMEOUT_MS ?? 90_000),
  };
}
