import http from "node:http";
import { startServer } from "../src/server.js";

function requestJson({ port, path, hostHeader, token }) {
  const body = JSON.stringify({
    update_id: 2001,
    message: {
      message_id: 21,
      text: "host allow-list smoke",
      chat: { id: 9001 },
      from: { id: 3001 },
    },
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: "POST",
        hostname: "127.0.0.1",
        port,
        path,
        headers: {
          host: hostHeader,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "x-telegram-bot-api-secret-token": token,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: data ? JSON.parse(data) : {},
          });
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const env = {
  TELEGRAM_BOT_TOKEN: "token-123",
  TELEGRAM_WEBHOOK_SECRET_TOKEN: "tg-secret-123",
  TELEGRAM_WEBHOOK_PATH: "/telegram/webhook",
  PAPERCLIP_ALLOWED_HOSTNAMES: "allowed.example.com,76.13.48.145:55035",
};

const server = await startServer({
  port: 0,
  env,
  logger: { log() {}, warn() {}, error() {} },
});

try {
  const address = server.address();
  const port = Number(address.port);
  const allowed = await requestJson({
    port,
    path: "/telegram/webhook",
    hostHeader: "allowed.example.com",
    token: "tg-secret-123",
  });
  if (allowed.statusCode === 403 || allowed.body?.error === "host_not_allowed") {
    throw new Error(`Expected allowed host request not to be host-blocked, got ${allowed.statusCode}`);
  }

  const blocked = await requestJson({
    port,
    path: "/telegram/webhook",
    hostHeader: "blocked.example.com",
    token: "tg-secret-123",
  });
  if (blocked.statusCode !== 403 || blocked.body?.error !== "host_not_allowed") {
    throw new Error(`Expected blocked host request to return 403 host_not_allowed, got ${blocked.statusCode}`);
  }

  console.log(JSON.stringify({
    smoke: "pass",
    scenario: "host-allowlist",
    allowedStatus: allowed.statusCode,
    blockedStatus: blocked.statusCode,
  }, null, 2));
} finally {
  server.close();
}
