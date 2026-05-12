"use strict";

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

function getNotifierConfig(env = process.env) {
  return {
    botToken: env.TELEGRAM_BOT_TOKEN || "",
    chatId: env.TELEGRAM_NOTIFY_CHAT_ID || env.TELEGRAM_ALLOWED_CHAT_ID || "",
    webhookToken: env.PAPERCLIP_WEBHOOK_TOKEN || "",
    webhookPath: env.PAPERCLIP_ISSUE_EVENT_PATH || "/paperclip/issues/events",
    notifyStatuses: String(env.TELEGRAM_NOTIFY_STATUSES || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    gateLockStatuses: String(env.TELEGRAM_GATE_LOCK_STATUSES || "in_review,done")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    maxRetries: Number.parseInt(String(env.TELEGRAM_SEND_MAX_RETRIES || "2"), 10),
    retryBackoffMs: Number.parseInt(String(env.TELEGRAM_SEND_RETRY_BACKOFF_MS || "250"), 10),
    dedupeTtlMs: Number.parseInt(String(env.TELEGRAM_NOTIFY_DEDUPE_TTL_MS || "300000"), 10),
    dedupeMaxEntries: Number.parseInt(String(env.TELEGRAM_NOTIFY_DEDUPE_MAX_ENTRIES || "1000"), 10),
  };
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function hasRealityGateEvidence(issue = {}) {
  return toBool(issue?.realityGateComplete) ||
    toBool(issue?.gates?.reality?.complete) ||
    toBool(issue?.realityProof?.realityGateComplete) ||
    toBool(issue?.metadata?.realityGateComplete);
}

function hasProofGateEvidence(issue = {}) {
  return toBool(issue?.proofGateComplete) ||
    toBool(issue?.gates?.proof?.complete) ||
    toBool(issue?.realityProof?.proofGateComplete) ||
    toBool(issue?.metadata?.proofGateComplete);
}

function resolveFromStatus(req = {}, issue = {}) {
  return String(
    req.body?.transition?.from ||
    req.body?.fromStatus ||
    issue?.fromStatus ||
    issue?.previousStatus ||
    "",
  ).trim();
}

function evaluateGateLock({ req = {}, issue = {}, gateLockStatuses = [] } = {}) {
  const toStatus = String(issue?.status || "").trim();
  if (!toStatus || !gateLockStatuses.includes(toStatus)) return { blocked: false };

  const fromStatus = resolveFromStatus(req, issue);
  if (fromStatus && fromStatus === toStatus) return { blocked: false };

  const realityOk = hasRealityGateEvidence(issue);
  const proofOk = hasProofGateEvidence(issue);
  if (realityOk && proofOk) return { blocked: false };

  return {
    blocked: true,
    reason: "transition_blocked_missing_reality_proof_gates",
    details: {
      fromStatus: fromStatus || null,
      toStatus,
      realityGateComplete: realityOk,
      proofGateComplete: proofOk,
    },
  };
}

function formatIssueEventMessage(event) {
  const identifier = event?.identifier || event?.key || "unknown";
  const title = event?.title || "Untitled issue";
  const status = event?.status || "unknown";
  const priority = event?.priority || "unknown";
  const actor = event?.actor || event?.updatedBy || "system";
  const url = event?.url || "";
  const stageType = String(event?.executionState?.currentStageType || "").trim();
  const action =
    status === "done"
      ? "Completed"
      : status === "in_review" && stageType === "approval"
        ? "Approval required"
        : "";

  const lines = [
    "Issue update",
    `${identifier}: ${title}`,
    `Status: ${status}`,
    `Priority: ${priority}`,
    `By: ${actor}`,
  ];
  if (action) lines.push(`Action: ${action}`);
  if (url) lines.push(`Link: ${url}`);
  return lines.join("\n");
}

function detectIssueEventKind(req = {}, issue = {}) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const eventRaw = String(body.event || body.eventType || body.type || "").trim().toLowerCase();
  if (["issue_created", "created", "issue.create", "issue.created"].includes(eventRaw)) return "created";
  if (["issue_status_changed", "status_changed", "issue.status_changed"].includes(eventRaw)) return "status_changed";

  const fromStatus = resolveFromStatus(req, issue);
  const toStatus = String(issue?.status || body?.transition?.to || body?.toStatus || "").trim();
  if (fromStatus && toStatus && fromStatus !== toStatus) return "status_changed";

  const createdAt = String(issue?.createdAt || "").trim();
  const updatedAt = String(issue?.updatedAt || "").trim();
  if (createdAt && updatedAt && createdAt === updatedAt) return "created";

  return "other";
}

function formatConfirmationMessage(req = {}, issue = {}) {
  const kind = detectIssueEventKind(req, issue);
  if (kind === "created") {
    const identifier = issue?.identifier || issue?.key || "unknown";
    const title = issue?.title || "Untitled issue";
    const status = issue?.status || "unknown";
    const url = issue?.url || "";
    const lines = ["Issue erstellt", `${identifier}: ${title}`, `Status: ${status}`];
    if (url) lines.push(`Link: ${url}`);
    return { kind, text: lines.join("\n") };
  }

  if (kind === "status_changed") {
    const identifier = issue?.identifier || issue?.key || "unknown";
    const title = issue?.title || "Untitled issue";
    const fromStatus = resolveFromStatus(req, issue) || "unknown";
    const toStatus = issue?.status || "unknown";
    const url = issue?.url || "";
    const lines = ["Statuswechsel", `${identifier}: ${title}`, `Von: ${fromStatus}`, `Nach: ${toStatus}`];
    if (url) lines.push(`Link: ${url}`);
    return { kind, text: lines.join("\n") };
  }

  return { kind, text: formatIssueEventMessage(issue) };
}

function computeEventDedupeKey(req = {}, issue = {}, eventKind = "other") {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const explicitEventId = String(
    body.eventId ||
    body.id ||
    body.deliveryId ||
    body.traceId ||
    issue?.eventId ||
    "",
  ).trim();
  if (explicitEventId) return `${eventKind}:id:${explicitEventId}`;

  const identifier = String(issue?.identifier || issue?.id || "").trim();
  const fromStatus = resolveFromStatus(req, issue);
  const toStatus = String(issue?.status || body?.transition?.to || "").trim();
  const updatedAt = String(issue?.updatedAt || body?.updatedAt || "").trim();
  const createdAt = String(issue?.createdAt || body?.createdAt || "").trim();
  return `${eventKind}:issue:${identifier}:from:${fromStatus}:to:${toStatus}:updated:${updatedAt}:created:${createdAt}`;
}

function createDedupeStore({ ttlMs = 300000, maxEntries = 1000 } = {}) {
  const seen = new Map();
  function cleanup(now) {
    for (const [key, expiresAt] of seen.entries()) {
      if (expiresAt <= now) seen.delete(key);
    }
    while (seen.size > maxEntries) {
      const firstKey = seen.keys().next().value;
      if (!firstKey) break;
      seen.delete(firstKey);
    }
  }
  return {
    has(key, now = Date.now()) {
      cleanup(now);
      const expiresAt = seen.get(key);
      if (!expiresAt) return false;
      if (expiresAt <= now) {
        seen.delete(key);
        return false;
      }
      return true;
    },
    add(key, now = Date.now()) {
      cleanup(now);
      seen.set(key, now + ttlMs);
    },
  };
}

async function sendTelegramMessage({ botToken, chatId, text, fetchImpl = fetch }) {
  if (!botToken) throw new Error("missing_bot_token");
  if (!chatId) throw new Error("missing_notify_chat_id");

  const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`telegram_send_failed:${response.status}:${body}`);
  }

  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry({
  botToken,
  chatId,
  text,
  fetchImpl = fetch,
  logger = console,
  maxRetries = 2,
  retryBackoffMs = 250,
}) {
  let attempt = 0;
  while (true) {
    try {
      return await sendTelegramMessage({ botToken, chatId, text, fetchImpl });
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      attempt += 1;
      logger.warn("[telegram-bridge] telegram send failed, retrying", {
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(retryBackoffMs * attempt);
    }
  }
}

function createIssueEventNotifier({ env = process.env, fetchImpl = fetch, logger = console } = {}) {
  const cfg = getNotifierConfig(env);
  const dedupeStore = createDedupeStore({
    ttlMs: Number.isFinite(cfg.dedupeTtlMs) ? cfg.dedupeTtlMs : 300000,
    maxEntries: Number.isFinite(cfg.dedupeMaxEntries) ? cfg.dedupeMaxEntries : 1000,
  });

  return async function handleIssueEvent(req = {}) {
    const method = String(req.method || "POST").toUpperCase();
    const path = normalizePath(req.path || "/");
    const provided = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim();

    if (method !== "POST") return { status: 405, body: { ok: false, error: "method_not_allowed" } };
    if (path !== normalizePath(cfg.webhookPath)) return { status: 404, body: { ok: false, error: "not_found" } };
    if (!cfg.webhookToken) return { status: 500, body: { ok: false, error: "missing_webhook_token" } };
    if (provided !== cfg.webhookToken) return { status: 401, body: { ok: false, error: "unauthorized" } };

    const issue = req.body?.issue || req.body || {};
    const gateLockResult = evaluateGateLock({
      req,
      issue,
      gateLockStatuses: cfg.gateLockStatuses,
    });
    if (gateLockResult.blocked) {
      logger.warn("[telegram-bridge] transition gate-lock blocked", {
        identifier: issue.identifier,
        ...gateLockResult.details,
      });
      return {
        status: 409,
        body: {
          ok: false,
          error: gateLockResult.reason,
          gateLock: gateLockResult.details,
        },
      };
    }

    if (cfg.notifyStatuses.length > 0 && !cfg.notifyStatuses.includes(String(issue.status || ""))) {
      return {
        status: 200,
        body: { ok: true, sent: false, skipped: true, reason: "status_filtered" },
      };
    }
    const confirmation = formatConfirmationMessage(req, issue);
    if (!["created", "status_changed"].includes(confirmation.kind)) {
      return { status: 200, body: { ok: true, sent: false, skipped: true, reason: "event_filtered" } };
    }
    const dedupeKey = computeEventDedupeKey(req, issue, confirmation.kind);
    if (dedupeStore.has(dedupeKey)) {
      return { status: 200, body: { ok: true, sent: false, skipped: true, reason: "duplicate_event" } };
    }
    const telegramResult = await sendWithRetry({
      botToken: cfg.botToken,
      chatId: cfg.chatId,
      text: confirmation.text,
      fetchImpl,
      logger,
      maxRetries: Number.isFinite(cfg.maxRetries) ? cfg.maxRetries : 2,
      retryBackoffMs: Number.isFinite(cfg.retryBackoffMs) ? cfg.retryBackoffMs : 250,
    });
    dedupeStore.add(dedupeKey);

    logger.log("[telegram-bridge] sent issue-event notification", {
      identifier: issue.identifier,
      status: issue.status,
      priority: issue.priority,
    });

    return { status: 200, body: { ok: true, sent: true, telegramResult } };
  };
}

module.exports = {
  computeEventDedupeKey,
  createIssueEventNotifier,
  createDedupeStore,
  detectIssueEventKind,
  evaluateGateLock,
  formatConfirmationMessage,
  formatIssueEventMessage,
  getNotifierConfig,
  hasProofGateEvidence,
  hasRealityGateEvidence,
  normalizePath,
  resolveFromStatus,
  sendWithRetry,
  sendTelegramMessage,
};
