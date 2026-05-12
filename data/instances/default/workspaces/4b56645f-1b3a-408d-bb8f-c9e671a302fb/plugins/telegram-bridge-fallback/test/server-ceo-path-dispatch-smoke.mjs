import { startServer } from "../src/server.js";

const env = {
  TELEGRAM_BOT_TOKEN: "tg-bot-token",
  TELEGRAM_WEBHOOK_SECRET_TOKEN: "tg-secret-token",
  TELEGRAM_WEBHOOK_PATH: "/telegram/webhook",
};

const server = await startServer({ port: 0, env, logger: { log() {}, warn() {}, error() {} } });
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const baseUrl = `http://127.0.0.1:${port}`;

const rawTelegramPayload = {
  update_id: 1007,
  message: {
    message_id: 42,
    text: "raw telegram to /paperclip/telegram/ceo",
    chat: { id: 1212692747 },
    from: { id: 1212692747 },
  },
};

try {
  const response = await fetch(`${baseUrl}/paperclip/telegram/ceo`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": "tg-secret-token",
    },
    body: JSON.stringify(rawTelegramPayload),
  });
  const body = await response.json();

  if (response.status !== 503 || body?.error !== "route_not_processed") {
    throw new Error(`Expected 503 route_not_processed from bridge dispatch, got ${response.status}`);
  }

  console.log(
    JSON.stringify(
      {
        smoke: "pass",
        scenario: "server-ceo-path-dispatch",
        status: response.status,
        error: body?.error,
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}
