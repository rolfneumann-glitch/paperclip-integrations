"use strict";

function trimString(value) {
  return String(value || "").trim();
}

function getIntakeConfig(env = process.env) {
  const paperclipWebhookToken = trimString(env.PAPERCLIP_WEBHOOK_TOKEN);
  const telegramWebhookSecretToken = trimString(env.TELEGRAM_WEBHOOK_SECRET_TOKEN);
  return {
    // Keep legacy PAPERCLIP_WEBHOOK_TOKEN first, then accept Telegram secret token
    // to avoid auth mismatch between /telegram/webhook and /paperclip/telegram/ceo.
    webhookToken: paperclipWebhookToken || telegramWebhookSecretToken,
    apiUrl: trimString(env.PAPERCLIP_API_URL || "http://localhost:3100").replace(/\/+$/, ""),
    apiKey: trimString(env.PAPERCLIP_API_KEY),
    companyId: trimString(env.PAPERCLIP_COMPANY_ID),
    ceoAgentId: trimString(env.PAPERCLIP_CEO_AGENT_ID),
    systemArchitectAgentId: trimString(env.PAPERCLIP_SYSTEM_ARCHITECT_AGENT_ID),
    telegramBotToken: trimString(env.TELEGRAM_BOT_TOKEN),
  };
}

function parseBearerToken(value) {
  const raw = trimString(value);
  if (!raw) return "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return trimString(match ? match[1] : "");
}

function validateIntakeBody(body) {
  const payload = body && typeof body === "object" ? body : {};
  const source = trimString(payload.source);
  const route = trimString(payload.route);
  const text = trimString(payload.text);
  const telegram = payload.telegram && typeof payload.telegram === "object" ? payload.telegram : {};
  const chatId = trimString(telegram.chatId);

  if (source !== "telegram") return { ok: false, error: "invalid_source" };
  if (route !== "ceo") return { ok: false, error: "invalid_route" };
  if (!text) return { ok: false, error: "invalid_text" };
  if (!chatId) return { ok: false, error: "invalid_telegram_chat_id" };

  return {
    ok: true,
    value: {
      source,
      route,
      text,
      telegram: {
        chatId,
        userId: trimString(telegram.userId),
        username: trimString(telegram.username),
        messageId: trimString(telegram.messageId),
        updateId: trimString(telegram.updateId),
      },
      raw: payload,
    },
  };
}

function buildIssueDescription(input, workflow) {
  const gateLines = [
    "Reality/Proof gates (mandatory before delegation/closure):",
    "- Reality Gate",
    "  - Verified components + source of truth listed",
    "  - Explicit assumptions listed and owner assigned",
    "  - Current blockers listed with unblock owner",
    "- Proof Gate",
    "  - External end-to-end proof URL/evidence included for each sub-task",
    "  - Proof timestamp (UTC) and measurable outcome included",
    "",
    "Workflow guardrail:",
    "- This issue must not be delegated onward or closed without filled Reality/Proof gates.",
    `- Intake route: ${workflow}`,
    "",
  ];
  const lines = [
    "Inbound CEO Telegram intake.",
    "",
    `Text: ${input.text}`,
    "",
    ...gateLines,
    "Telegram metadata:",
    `- chatId: ${input.telegram.chatId || "unknown"}`,
    `- userId: ${input.telegram.userId || "unknown"}`,
    `- username: ${input.telegram.username || "unknown"}`,
    `- messageId: ${input.telegram.messageId || "unknown"}`,
    `- updateId: ${input.telegram.updateId || "unknown"}`,
    "",
    "Raw payload:",
    "```json",
    JSON.stringify(input.raw, null, 2),
    "```",
  ];
  return lines.join("\n");
}

function buildIssueTitle(text) {
  const compact = text.replace(/\s+/g, " ").trim();
  const preview = compact.length > 90 ? `${compact.slice(0, 87)}...` : compact;
  return `CEO Telegram intake: ${preview}`;
}

async function resolveCeoAgentId(cfg, fetchImpl) {
  if (cfg.ceoAgentId) return cfg.ceoAgentId;
  const response = await fetchImpl(`${cfg.apiUrl}/api/companies/${cfg.companyId}/agents`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "content-type": "application/json",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ceo_lookup_failed:${response.status}:${body}`);
  }
  const agents = await response.json();
  const ceo = Array.isArray(agents) ? agents.find((agent) => String(agent?.role) === "ceo") : null;
  if (!ceo?.id) throw new Error("ceo_not_found");
  return ceo.id;
}

function isComplexIssue(text) {
  const normalized = trimString(text).toLowerCase();
  if (!normalized) return false;
  if (normalized.length >= 80) return true;
  const complexityKeywords = [
    "architektur",
    "architecture",
    "system",
    "workflow",
    "proof",
    "gate",
    "integration",
    "migration",
    "security",
    "compliance",
    "risk",
    "blocker",
  ];
  return complexityKeywords.some((keyword) => normalized.includes(keyword));
}

function pickSystemArchitect(agents) {
  if (!Array.isArray(agents)) return null;
  return (
    agents.find((agent) => String(agent?.role || "").toLowerCase() === "system_architect") ||
    agents.find((agent) => String(agent?.name || "").toLowerCase().includes("system-architekt")) ||
    agents.find((agent) => String(agent?.name || "").toLowerCase().includes("system architect")) ||
    null
  );
}

async function resolveSystemArchitectAgentId(cfg, fetchImpl) {
  if (cfg.systemArchitectAgentId) return cfg.systemArchitectAgentId;
  const response = await fetchImpl(`${cfg.apiUrl}/api/companies/${cfg.companyId}/agents`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "content-type": "application/json",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`system_architect_lookup_failed:${response.status}:${body}`);
  }
  const agents = await response.json();
  const architect = pickSystemArchitect(agents);
  if (!architect?.id) throw new Error("system_architect_not_found");
  return architect.id;
}

async function createIssue(cfg, assigneeAgentId, input, workflow, fetchImpl) {
  const response = await fetchImpl(`${cfg.apiUrl}/api/companies/${cfg.companyId}/issues`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: buildIssueTitle(input.text),
      description: buildIssueDescription(input, workflow),
      status: "todo",
      priority: "high",
      assigneeAgentId,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`issue_create_failed:${response.status}:${body}`);
  }

  return response.json();
}

async function sendAck(cfg, input, issue, fetchImpl) {
  if (!cfg.telegramBotToken) throw new Error("missing_bot_token");
  const issueLabel = issue?.identifier || issue?.id || "unknown";
  const issueUrl = trimString(issue?.url);
  const lines = [
    `Received. Created issue ${issueLabel} for CEO review.`,
  ];
  if (issueUrl) lines.push(issueUrl);
  const response = await fetchImpl(`https://api.telegram.org/bot${cfg.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: input.telegram.chatId,
      text: lines.join("\n"),
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ack_send_failed:${response.status}:${body}`);
  }
  return response.json();
}

function createCeoIntakeHandler({ env = process.env, fetchImpl = fetch, logger = console } = {}) {
  const cfg = getIntakeConfig(env);

  return async function handleCeoIntake(req = {}) {
    const method = String(req.method || "").toUpperCase();
    if (method !== "POST") return { status: 405, body: { ok: false, error: "method_not_allowed" } };
    if (!cfg.webhookToken) return { status: 500, body: { ok: false, error: "missing_webhook_token" } };
    if (!cfg.apiKey) return { status: 500, body: { ok: false, error: "missing_api_key" } };
    if (!cfg.companyId) return { status: 500, body: { ok: false, error: "missing_company_id" } };

    const provided = parseBearerToken(req.headers?.authorization);
    if (provided !== cfg.webhookToken) return { status: 401, body: { ok: false, error: "unauthorized" } };

    const parsed = validateIntakeBody(req.body);
    if (!parsed.ok) return { status: 400, body: { ok: false, error: parsed.error } };

    try {
      const complexIssue = isComplexIssue(parsed.value.text);
      const ceoAgentId = await resolveCeoAgentId(cfg, fetchImpl);
      const assigneeAgentId = complexIssue ? await resolveSystemArchitectAgentId(cfg, fetchImpl) : ceoAgentId;
      const workflow = complexIssue ? "system-architect-first" : "ceo-direct";
      const issue = await createIssue(cfg, assigneeAgentId, parsed.value, workflow, fetchImpl);
      const ack = await sendAck(cfg, parsed.value, issue, fetchImpl);
      logger.log("[telegram-bridge] ceo intake created issue", {
        issueId: issue?.id,
        identifier: issue?.identifier,
        assigneeAgentId: issue?.assigneeAgentId || assigneeAgentId,
        workflow,
      });
      return {
        status: 200,
        body: {
          ok: true,
          issue: {
            id: issue?.id,
            identifier: issue?.identifier,
            url: issue?.url || null,
            assigneeAgentId: issue?.assigneeAgentId || assigneeAgentId,
            workflow,
          },
          ackSent: true,
          telegramResult: ack || null,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal_error";
      return { status: 502, body: { ok: false, error: message } };
    }
  };
}

module.exports = {
  buildIssueDescription,
  buildIssueTitle,
  createCeoIntakeHandler,
  getIntakeConfig,
  parseBearerToken,
  validateIntakeBody,
};
