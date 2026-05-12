import { startServer } from "../src/server.js";

const env = {
  PAPERCLIP_WEBHOOK_TOKEN: "whsec-123",
  PAPERCLIP_API_KEY: "pc-api-key",
  PAPERCLIP_COMPANY_ID: "company-123",
  TELEGRAM_BOT_TOKEN: "tg-bot-token",
};

const server = await startServer({ port: 0, env, logger: { log() {}, warn() {}, error() {} } });
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const baseUrl = `http://127.0.0.1:${port}`;

const payload = {
  source: "telegram",
  route: "ceo",
  text: "Need auth check",
  telegram: { chatId: "1" },
};

try {
  const missingAuth = await fetch(`${baseUrl}/paperclip/telegram/ceo/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const missingAuthBody = await missingAuth.json();
  if (missingAuth.status !== 401 || missingAuthBody?.error !== "unauthorized") {
    throw new Error(`Expected 401 unauthorized for missing auth, got ${missingAuth.status}`);
  }

  const invalidAuth = await fetch(`${baseUrl}/paperclip/telegram/ceo/`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer wrong",
    },
    body: JSON.stringify(payload),
  });
  const invalidAuthBody = await invalidAuth.json();
  if (invalidAuth.status !== 401 || invalidAuthBody?.error !== "unauthorized") {
    throw new Error(`Expected 401 unauthorized for invalid auth, got ${invalidAuth.status}`);
  }

  console.log(
    JSON.stringify(
      {
        smoke: "pass",
        scenario: "server-ceo-auth",
        missingStatus: missingAuth.status,
        invalidStatus: invalidAuth.status,
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}
