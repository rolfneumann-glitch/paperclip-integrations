"use strict";

function parseIntOrDefault(raw, fallback) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRouteConfig(env = process.env) {
  return {
    forwardUrl: String(env.PAPERCLIP_CEO_FORWARD_URL || "").trim(),
    forwardToken: String(env.PAPERCLIP_CEO_FORWARD_TOKEN || "").trim(),
    timeoutMs: parseIntOrDefault(env.PAPERCLIP_CEO_FORWARD_TIMEOUT_MS, 5000),
  };
}

async function forwardEvent({ event, cfg, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const headers = { "content-type": "application/json" };
    if (cfg.forwardToken) headers.authorization = `Bearer ${cfg.forwardToken}`;
    const response = await fetchImpl(cfg.forwardUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: event?.payload?.text || "",
        event
      }),
      signal: controller.signal,
    });
    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`forward_failed:${response.status}:${bodyText}`);
    }
    return { status: response.status, body: bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

function createCeoRouteHandler(logger = console, options = {}) {
  const cfg = getRouteConfig(options.env || process.env);
  const fetchImpl = options.fetchImpl || fetch;

  return async function routeToCeo(event) {
    const eventId =
      event?.eventId || `telegram:${event?.payload?.chatId || "unknown-chat"}:${event?.updateId ?? "unknown-update"}`;
    logger.log("[telegram-bridge] routed event", {
      source: event.source,
      route: event.route,
      updateId: event.updateId,
      type: event.payload?.type,
      chatId: event.payload?.chatId,
      occurredAt: event.occurredAt,
    });

    if (!cfg.forwardUrl) {
      logger.warn("[telegram-bridge] event not forwarded: missing PAPERCLIP_CEO_FORWARD_URL", {
        eventId,
        updateId: event.updateId,
      });
      return { accepted: false, route: "ceo", forwarded: false, reason: "forward_url_not_configured" };
    }

    const forwardResult = await forwardEvent({ event, cfg, fetchImpl });
    logger.log("[telegram-bridge] forwarded event to paperclip", {
      destination: cfg.forwardUrl,
      status: forwardResult.status,
    });
    return { accepted: true, route: "ceo", forwarded: true, forwardStatus: forwardResult.status };
  };
}

module.exports = {
  createCeoRouteHandler,
  getRouteConfig,
  forwardEvent,
};
