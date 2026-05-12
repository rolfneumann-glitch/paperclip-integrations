import { createBridge } from "../src/bridge.js";

const events = [];
const routeHandler = async (event) => {
  events.push(event);
  return { accepted: true, route: "ceo" };
};

const env = {
  TELEGRAM_BOT_TOKEN: "token-123",
  TELEGRAM_WEBHOOK_SECRET_TOKEN: "tg-secret-123",
  TELEGRAM_WEBHOOK_PATH: "/telegram/webhook",
  TELEGRAM_WEBHOOK_PATH_ALIASES: "/webhook,/tg/webhook",
};

const bridge = createBridge({ env, routeHandler });
const ts = new Date().toISOString();

const response = await bridge({
  method: "POST",
  path: "/telegram/webhook/?source=telegram",
  headers: { "x-telegram-bot-api-secret-token": "tg-secret-123" },
  body: {
    update_id: 1001,
    message: {
      message_id: 11,
      text: "hello ceo",
      chat: { id: 9001 },
      from: { id: 3001 },
    },
  },
});

if (response.status !== 200) {
  throw new Error(`Expected 200 but got ${response.status}`);
}
if (!response.body.ok || response.body.routedTo !== "ceo") {
  throw new Error("Expected successful CEO routing");
}
if (events.length !== 1) {
  throw new Error(`Expected 1 routed event, got ${events.length}`);
}

const trailingSlashResponse = await bridge({
  method: "POST",
  path: "/telegram/webhook/",
  headers: { "x-telegram-bot-api-secret-token": "tg-secret-123" },
  body: {
    update_id: 1002,
    message: {
      message_id: 12,
      text: "hello ceo slash",
      chat: { id: 9001 },
      from: { id: 3001 },
    },
  },
});

if (trailingSlashResponse.status !== 200) {
  throw new Error(`Expected trailing-slash path to pass, got ${trailingSlashResponse.status}`);
}

const aliasResponse = await bridge({
  method: "POST",
  path: "/webhook",
  headers: { "x-telegram-bot-api-secret-token": "tg-secret-123" },
  body: {
    update_id: 1003,
    message: {
      message_id: 13,
      text: "hello ceo alias",
      chat: { id: 9001 },
      from: { id: 3001 },
    },
  },
});

if (aliasResponse.status !== 200) {
  throw new Error(`Expected alias path to pass, got ${aliasResponse.status}`);
}

const ceoIntakeResponse = await bridge({
  method: "POST",
  path: "/paperclip/telegram/ceo",
  headers: { "x-telegram-bot-api-secret-token": "tg-secret-123" },
  body: {
    update_id: 1005,
    message: {
      message_id: 15,
      text: "hello ceo intake endpoint",
      chat: { id: 9001 },
      from: { id: 3001 },
    },
  },
});

if (ceoIntakeResponse.status !== 200) {
  throw new Error(`Expected /paperclip/telegram/ceo path to pass, got ${ceoIntakeResponse.status}`);
}

const event = events[0];
if (event.payload.text !== "hello ceo" || event.payload.chatId !== "9001") {
  throw new Error("Normalized payload mismatch");
}
if (!event.eventId || !String(event.eventId).startsWith("telegram:")) {
  throw new Error("Expected eventId correlation identifier on normalized event");
}

const unprocessedBridge = createBridge({
  env,
  routeHandler: async () => ({ accepted: false, route: "ceo", forwarded: false, reason: "forward_url_not_configured" }),
});
const unprocessedResponse = await unprocessedBridge({
  method: "POST",
  path: "/telegram/webhook",
  headers: { "x-telegram-bot-api-secret-token": "tg-secret-123" },
  body: {
    update_id: 1004,
    message: {
      message_id: 14,
      text: "hello ceo unprocessed",
      chat: { id: 9001 },
      from: { id: 3001 },
    },
  },
});
if (unprocessedResponse.status !== 503 || unprocessedResponse.body?.error !== "route_not_processed") {
  throw new Error(`Expected explicit 503 route_not_processed, got ${unprocessedResponse.status}`);
}

console.log(JSON.stringify({
  smoke: "pass",
  timestamp: ts,
  routedTo: response.body.routedTo,
  updateType: response.body.updateType,
  chatId: event.payload.chatId,
  updateId: event.updateId,
}, null, 2));
