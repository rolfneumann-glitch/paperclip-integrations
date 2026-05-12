"use strict";

function parsePathList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getConfig(env = process.env) {
  return {
    botToken: env.TELEGRAM_BOT_TOKEN || "",
    webhookSecretToken: env.TELEGRAM_WEBHOOK_SECRET_TOKEN || "",
    allowedChatId: env.TELEGRAM_ALLOWED_CHAT_ID || "",
    webhookPath: env.TELEGRAM_WEBHOOK_PATH || "/telegram/webhook",
    webhookPathAliases: parsePathList(env.TELEGRAM_WEBHOOK_PATH_ALIASES || ""),
  };
}

function normalizePath(path) {
  const parsed = String(path || "/").trim();
  const raw = (() => {
    try {
      return new URL(parsed, "http://localhost").pathname || "/";
    } catch {
      return parsed;
    }
  })();
  if (!raw) return "/";
  if (raw === "/") return "/";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function getAcceptedWebhookPaths(cfg) {
  const unique = new Set([
    normalizePath("/telegram/webhook"),
    normalizePath("/paperclip/telegram/ceo"),
    normalizePath(cfg.webhookPath),
    ...cfg.webhookPathAliases.map((p) => normalizePath(p)),
  ]);
  return Array.from(unique);
}

function extractToken(headerValue) {
  if (!headerValue) return "";
  const trimmed = String(headerValue).trim();
  if (!trimmed) return "";
  const prefix = "Bearer ";
  if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length).trim();
  return trimmed;
}

function parseTelegramUpdate(body) {
  if (!body || typeof body !== "object") {
    return { type: "unknown", chatId: "", text: "", userId: "", updateId: undefined };
  }

  if (body.message) {
    return {
      type: "message",
      chatId: String(body.message.chat?.id ?? ""),
      text: String(body.message.text ?? ""),
      userId: String(body.message.from?.id ?? ""),
      updateId: body.update_id,
    };
  }

  if (body.callback_query) {
    return {
      type: "callback_query",
      chatId: String(body.callback_query.message?.chat?.id ?? ""),
      text: String(body.callback_query.data ?? ""),
      userId: String(body.callback_query.from?.id ?? ""),
      updateId: body.update_id,
    };
  }

  return { type: "unknown", chatId: "", text: "", userId: "", updateId: body.update_id };
}

function normalizeEvent(update, rawBody) {
  const chatId = update.chatId || "unknown-chat";
  const updateId = update.updateId ?? "unknown-update";
  const eventId = `telegram:${chatId}:${updateId}`;
  return {
    eventId,
    source: "telegram",
    route: "ceo",
    occurredAt: new Date().toISOString(),
    updateId: update.updateId,
    payload: {
      type: update.type,
      chatId: update.chatId,
      userId: update.userId,
      text: update.text,
      raw: rawBody,
    },
  };
}

function createBridge({ env = process.env, routeHandler } = {}) {
  if (typeof routeHandler !== "function") {
    throw new Error("routeHandler is required");
  }

  const cfg = getConfig(env);
  const acceptedWebhookPaths = getAcceptedWebhookPaths(cfg);

  return async function handleRequest(req = {}) {
    const method = String(req.method || "POST").toUpperCase();
    const path = normalizePath(req.path || "/");

    if (method !== "POST") {
      return { status: 405, body: { ok: false, error: "method_not_allowed" } };
    }

    if (!acceptedWebhookPaths.includes(path)) {
      return { status: 404, body: { ok: false, error: "not_found" } };
    }

    if (!cfg.botToken) {
      return { status: 500, body: { ok: false, error: "missing_bot_token" } };
    }

    const secretHeader = String(
      req.headers?.["x-telegram-bot-api-secret-token"] ||
        req.headers?.["X-Telegram-Bot-Api-Secret-Token"] ||
        "",
    ).trim();
    const provided = extractToken(req.headers?.authorization);
    const authOk = cfg.webhookSecretToken
      ? secretHeader === cfg.webhookSecretToken
      : provided === cfg.botToken;
    if (!authOk) {
      return { status: 401, body: { ok: false, error: "unauthorized" } };
    }

    const parsed = parseTelegramUpdate(req.body);
    if (cfg.allowedChatId && parsed.chatId && parsed.chatId !== String(cfg.allowedChatId)) {
      return { status: 403, body: { ok: false, error: "chat_not_allowed" } };
    }

    const event = normalizeEvent(parsed, req.body || {});
    const routeResult = await routeHandler(event);
    if (routeResult && routeResult.accepted === false) {
      return {
        status: 503,
        body: {
          ok: false,
          error: "route_not_processed",
          eventId: event.eventId,
          routedTo: event.route,
          updateType: parsed.type,
          routeResult,
        },
      };
    }

    return {
      status: 200,
      body: {
        ok: true,
        eventId: event.eventId,
        routedTo: event.route,
        updateType: parsed.type,
        routeResult: routeResult ?? null,
      },
    };
  };
}

module.exports = {
  createBridge,
  extractToken,
  normalizePath,
  parseTelegramUpdate,
  normalizeEvent,
  getAcceptedWebhookPaths,
};
