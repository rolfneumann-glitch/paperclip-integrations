import { startServer } from "../src/server.js";

const FIXED_SECRET = "fav-290-fixed-secret";

const env = {
  TELEGRAM_BOT_TOKEN: "tg-bot-token",
  TELEGRAM_WEBHOOK_SECRET_TOKEN: FIXED_SECRET,
  TELEGRAM_WEBHOOK_PATH: "/telegram/webhook",
};

const server = await startServer({ port: 0, env, logger: { log() {}, warn() {}, error() {} } });
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const baseUrl = `http://127.0.0.1:${port}`;

const telegramPayload = {
  update_id: 290001,
  message: {
    message_id: 290001,
    text: "FAV-290 direct webhook fixed secret",
    chat: { id: 1212692747 },
    from: { id: 1212692747 },
  },
};

async function post(path, secretToken) {
  const headers = { "content-type": "application/json" };
  if (secretToken !== undefined) {
    headers["x-telegram-bot-api-secret-token"] = secretToken;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(telegramPayload),
  });
  const body = await response.json();
  return { status: response.status, body };
}

try {
  const missing = await post("/telegram/webhook");
  const invalid = await post("/telegram/webhook", "wrong-secret");
  const valid = await post("/telegram/webhook", FIXED_SECRET);

  if (missing.status !== 401 || missing.body?.error !== "unauthorized") {
    throw new Error(`expected missing secret => 401 unauthorized, got ${missing.status}`);
  }
  if (invalid.status !== 401 || invalid.body?.error !== "unauthorized") {
    throw new Error(`expected invalid secret => 401 unauthorized, got ${invalid.status}`);
  }
  if (valid.status !== 503 || valid.body?.error !== "route_not_processed") {
    throw new Error(`expected valid fixed secret => 503 route_not_processed, got ${valid.status}`);
  }

  console.log(
    JSON.stringify(
      {
        smoke: "pass",
        scenario: "webhook-direct-fixed-secret",
        checks: {
          missingSecretStatus: missing.status,
          invalidSecretStatus: invalid.status,
          validSecretStatus: valid.status,
          validSecretError: valid.body?.error ?? null,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}
