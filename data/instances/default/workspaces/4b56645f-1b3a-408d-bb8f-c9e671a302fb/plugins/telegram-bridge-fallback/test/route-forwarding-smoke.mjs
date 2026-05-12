import { createCeoRouteHandler } from "../src/route-handler.js";

const event = {
  source: "telegram",
  route: "ceo",
  updateId: 2001,
  occurredAt: new Date().toISOString(),
  payload: { type: "message", chatId: "9001", userId: "3001", text: "hello" },
};

const forwardedRequests = [];
const okHandler = createCeoRouteHandler(console, {
  env: {
    PAPERCLIP_CEO_FORWARD_URL: "https://paperclip.local/api/ceo/telegram-events",
    PAPERCLIP_CEO_FORWARD_TOKEN: "pc-forward-token",
    PAPERCLIP_CEO_FORWARD_TIMEOUT_MS: "1500",
  },
  fetchImpl: async (url, init) => {
    forwardedRequests.push({ url, init });
    return {
      ok: true,
      status: 202,
      text: async () => "{\"accepted\":true}",
    };
  },
});

const okResult = await okHandler(event);
if (!okResult.forwarded || okResult.forwardStatus !== 202) {
  throw new Error("Expected forwarded route result with 202 status");
}
if (forwardedRequests.length !== 1) {
  throw new Error(`Expected one forwarded request, got ${forwardedRequests.length}`);
}
if (forwardedRequests[0].url !== "https://paperclip.local/api/ceo/telegram-events") {
  throw new Error("Unexpected forward destination URL");
}
if (forwardedRequests[0].init?.headers?.authorization !== "Bearer pc-forward-token") {
  throw new Error("Expected Bearer token header on forward request");
}

const noForwardHandler = createCeoRouteHandler(console, { env: {} });
const noForwardResult = await noForwardHandler(event);
if (
  noForwardResult.accepted !== false ||
  noForwardResult.forwarded !== false ||
  noForwardResult.reason !== "forward_url_not_configured"
) {
  throw new Error("Expected explicit unprocessed route result when forward URL is not configured");
}

const failingHandler = createCeoRouteHandler(console, {
  env: { PAPERCLIP_CEO_FORWARD_URL: "https://paperclip.local/api/fail" },
  fetchImpl: async () => ({
    ok: false,
    status: 502,
    text: async () => "bad gateway",
  }),
});

let failed = false;
try {
  await failingHandler(event);
} catch (error) {
  failed = String(error?.message || "").startsWith("forward_failed:502:");
}
if (!failed) {
  throw new Error("Expected forward failure to throw forward_failed error");
}

console.log(JSON.stringify({ smoke: "pass", scenario: "route-forwarding", timestamp: event.occurredAt }, null, 2));
