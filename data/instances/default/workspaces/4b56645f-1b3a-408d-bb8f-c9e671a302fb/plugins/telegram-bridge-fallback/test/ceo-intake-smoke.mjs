import { createCeoIntakeHandler } from "../src/ceo-intake.js";

const calls = [];
const ceoAgentId = "11111111-1111-4111-8111-111111111111";
const systemArchitectAgentId = "33333333-3333-4333-8333-333333333333";

const fetchImpl = async (url, options = {}) => {
  calls.push({ url, options });

  if (url === "https://paperclip.local/api/companies/company-123/agents") {
    return {
      ok: true,
      status: 200,
      json: async () => ([
        { id: "22222222-2222-4222-8222-222222222222", role: "cto" },
        { id: systemArchitectAgentId, role: "system_architect", name: "System-Architekt" },
        { id: ceoAgentId, role: "ceo" },
      ]),
      text: async () => "",
    };
  }

  if (url === "https://paperclip.local/api/companies/company-123/issues") {
    const payload = JSON.parse(options.body || "{}");
    if (payload.assigneeAgentId !== systemArchitectAgentId) {
      throw new Error("Issue assigneeAgentId was not System-Architekt");
    }
    if (payload.status !== "todo") {
      throw new Error("Issue status must be todo");
    }
    if (!String(payload.description || "").includes("Reality/Proof gates (mandatory")) {
      throw new Error("Gate template missing from issue description");
    }
    if (!String(payload.description || "").includes("Intake route: system-architect-first")) {
      throw new Error("Workflow marker missing from issue description");
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: "issue-1",
        identifier: "FAV-999",
        url: "https://paperclip.local/FAV/issues/FAV-999",
        assigneeAgentId: systemArchitectAgentId,
      }),
      text: async () => "",
    };
  }

  if (url === "https://api.telegram.org/bottg-bot-token/sendMessage") {
    const payload = JSON.parse(options.body || "{}");
    if (String(payload.chat_id) !== "1212692747") {
      throw new Error("Ack chat_id mismatch");
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
      text: async () => "",
    };
  }

  throw new Error(`Unexpected fetch URL: ${url}`);
};

const env = {
  PAPERCLIP_WEBHOOK_TOKEN: "whsec-123",
  PAPERCLIP_API_URL: "https://paperclip.local",
  PAPERCLIP_API_KEY: "pc-api-key",
  PAPERCLIP_COMPANY_ID: "company-123",
  TELEGRAM_BOT_TOKEN: "tg-bot-token",
};

const handler = createCeoIntakeHandler({ env, fetchImpl });

const unauthorized = await handler({
  method: "POST",
  headers: { authorization: "Bearer wrong" },
  body: { source: "telegram", route: "ceo", text: "x", telegram: { chatId: "1" } },
});
if (unauthorized.status !== 401 || unauthorized.body?.error !== "unauthorized") {
  throw new Error(`Expected auth rejection 401, got ${unauthorized.status}`);
}

const missingBearerPrefix = await handler({
  method: "POST",
  headers: { authorization: "whsec-123" },
  body: { source: "telegram", route: "ceo", text: "x", telegram: { chatId: "1" } },
});
if (missingBearerPrefix.status !== 401 || missingBearerPrefix.body?.error !== "unauthorized") {
  throw new Error(`Expected non-Bearer auth rejection 401, got ${missingBearerPrefix.status}`);
}

const created = await handler({
  method: "POST",
  headers: { authorization: "Bearer whsec-123" },
  body: {
    source: "telegram",
    route: "ceo",
    text: "Need architecture and workflow decision with proof gate evidence for integration rollout",
    telegram: {
      chatId: "1212692747",
      userId: "9001",
      username: "ceo_sender",
      messageId: "44",
      updateId: "555",
    },
  },
});

if (created.status !== 200 || !created.body?.ok) {
  throw new Error(`Expected successful intake, got status ${created.status}`);
}
if (created.body?.issue?.identifier !== "FAV-999") {
  throw new Error("Expected created issue identifier in response");
}
if (!created.body?.ackSent) {
  throw new Error("Expected ackSent true");
}
if (created.body?.issue?.workflow !== "system-architect-first") {
  throw new Error("Expected system-architect-first workflow");
}

const handlerWithTelegramSecretFallback = createCeoIntakeHandler({
  env: {
    PAPERCLIP_API_URL: "https://paperclip.local",
    PAPERCLIP_API_KEY: "pc-api-key",
    PAPERCLIP_COMPANY_ID: "company-123",
    TELEGRAM_BOT_TOKEN: "tg-bot-token",
    TELEGRAM_WEBHOOK_SECRET_TOKEN: "tg-whsec-456",
  },
  fetchImpl,
});
const fallbackAuthorized = await handlerWithTelegramSecretFallback({
  method: "POST",
  headers: { authorization: "Bearer tg-whsec-456" },
  body: {
    source: "telegram",
    route: "ceo",
    text: "Architecture check for webhook secret fallback",
    telegram: { chatId: "1212692747" },
  },
});
if (fallbackAuthorized.status !== 200 || !fallbackAuthorized.body?.ok) {
  throw new Error(`Expected TELEGRAM_WEBHOOK_SECRET_TOKEN fallback auth success, got ${fallbackAuthorized.status}`);
}

const issueCreateCall = calls.find((entry) => entry.url.endsWith("/issues"));
if (!issueCreateCall) throw new Error("Missing issue creation call");

console.log(JSON.stringify({
  smoke: "pass",
  scenario: "ceo-intake",
  unauthorizedStatus: unauthorized.status,
  nonBearerStatus: missingBearerPrefix.status,
  createdIdentifier: created.body.issue.identifier,
  ackSent: created.body.ackSent,
}, null, 2));
