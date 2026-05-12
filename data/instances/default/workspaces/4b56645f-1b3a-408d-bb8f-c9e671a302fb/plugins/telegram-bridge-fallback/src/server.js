"use strict";

const http = require("node:http");
const { URL } = require("node:url");
const { createBridge, getAcceptedWebhookPaths, normalizePath } = require("./bridge");
const { createIssueEventNotifier } = require("./issue-notifier");
const { createCeoRouteHandler } = require("./route-handler");
const { createCeoIntakeHandler } = require("./ceo-intake");

function parseAllowedHostnames(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHost(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
}

function extractRequestHost(req) {
  const xForwardedHost = req.headers?.["x-forwarded-host"];
  if (xForwardedHost) {
    const first = String(xForwardedHost).split(",")[0];
    return normalizeHost(first);
  }
  return normalizeHost(req.headers?.host);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error("payload_too_large"));
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function isNormalizedCeoIntakePayload(body) {
  if (!body || typeof body !== "object") return false;
  return body.source === "telegram" && body.route === "ceo";
}

async function startServer({ port = 8787, env = process.env, logger = console } = {}) {
  const telegramWebhookHandler = createBridge({ env, routeHandler: createCeoRouteHandler(logger) });
  const ceoIntakeHandler = createCeoIntakeHandler({ env, logger });
  const issueEventNotifier = createIssueEventNotifier({ env, logger });
  const allowedHosts = parseAllowedHostnames(env.PAPERCLIP_ALLOWED_HOSTNAMES || "");
  const configuredWebhookPath = env.TELEGRAM_WEBHOOK_PATH || "/telegram/webhook";
  const acceptedWebhookPaths = getAcceptedWebhookPaths({
    webhookPath: configuredWebhookPath,
    webhookPathAliases: String(env.TELEGRAM_WEBHOOK_PATH_ALIASES || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  });

  const server = http.createServer(async (req, res) => {
    try {
      const requestHost = extractRequestHost(req);
      if (allowedHosts.length > 0 && !allowedHosts.includes(requestHost)) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "host_not_allowed" }));
        return;
      }

      const body = await readJsonBody(req);
      const pathname = new URL(req.url || "/", "http://localhost").pathname;
      const normalizedPath = normalizePath(pathname);
      const request = {
        method: req.method,
        path: pathname,
        headers: req.headers,
        body,
      };
      const issueEventPath = normalizePath(env.PAPERCLIP_ISSUE_EVENT_PATH || "/paperclip/issues/events");
      const result = normalizedPath === "/paperclip/telegram/ceo"
        ? isNormalizedCeoIntakePayload(body)
          ? await ceoIntakeHandler(request)
          : await telegramWebhookHandler(request)
        : normalizedPath === issueEventPath
          ? await issueEventNotifier(request)
          : await telegramWebhookHandler(request);

      res.writeHead(result.status, { "content-type": "application/json" });
      res.end(JSON.stringify(result.body));
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal_error";
      const status = message === "payload_too_large" ? 413 : 400;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: message }));
    }
  });

  await new Promise((resolve) => server.listen(port, resolve));
  logger.log(`[telegram-bridge] listening on :${port}`);
  logger.log("[telegram-bridge] webhook paths", acceptedWebhookPaths);
  logger.log("[telegram-bridge] issue event path", env.PAPERCLIP_ISSUE_EVENT_PATH || "/paperclip/issues/events");
  logger.log("[telegram-bridge] allowed hosts", allowedHosts.length > 0 ? allowedHosts : "all");
  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error("[telegram-bridge] failed to start", err);
    process.exitCode = 1;
  });
}

module.exports = {
  startServer,
  parseAllowedHostnames,
  extractRequestHost,
  normalizeHost,
  isNormalizedCeoIntakePayload,
};
