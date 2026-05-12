import { createIssueEventNotifier } from "../src/issue-notifier.js";

const sentPayloads = [];
let attempts = 0;
const fetchImpl = async (_url, init) => {
  attempts += 1;
  sentPayloads.push(JSON.parse(init.body));
  if (attempts === 1) {
    return {
      ok: false,
      status: 500,
      async text() {
        return "temporary_error";
      },
    };
  }
  return {
    ok: true,
    async json() {
      return { ok: true, result: { message_id: 77 } };
    },
  };
};

const env = {
  TELEGRAM_BOT_TOKEN: "bot-token-1",
  TELEGRAM_NOTIFY_CHAT_ID: "5551",
  PAPERCLIP_WEBHOOK_TOKEN: "pc-token-1",
  PAPERCLIP_ISSUE_EVENT_PATH: "/paperclip/issues/events",
  TELEGRAM_SEND_MAX_RETRIES: "2",
  TELEGRAM_SEND_RETRY_BACKOFF_MS: "1",
  TELEGRAM_NOTIFY_STATUSES: "todo,in_progress,in_review,done",
};

const notifier = createIssueEventNotifier({ env, fetchImpl });
const blockedTransition = await notifier({
  method: "POST",
  path: "/paperclip/issues/events",
  headers: { authorization: "Bearer pc-token-1" },
  body: {
    transition: { from: "in_progress", to: "in_review" },
    issue: {
      identifier: "FAV-32",
      title: "Missing proof gates",
      status: "in_review",
      priority: "high",
      actor: "CTO",
      realityGateComplete: false,
      proofGateComplete: false,
    },
  },
});

if (blockedTransition.status !== 409 || blockedTransition.body?.error !== "transition_blocked_missing_reality_proof_gates") {
  throw new Error(`Expected transition lock 409, got status=${blockedTransition.status}`);
}

const response = await notifier({
  method: "POST",
  path: "/paperclip/issues/events",
  headers: { authorization: "Bearer pc-token-1" },
  body: {
    event: "issue_created",
    issue: {
      identifier: "FAV-33",
      title: "Implementierung: Telegram-Benachrichtigungen",
      status: "todo",
      priority: "medium",
      actor: "CTO",
      url: "https://paperclip.local/issues/FAV-33",
      createdAt: "2026-05-07T22:00:00.000Z",
      updatedAt: "2026-05-07T22:00:00.000Z",
    },
  },
});

const duplicateCreated = await notifier({
  method: "POST",
  path: "/paperclip/issues/events",
  headers: { authorization: "Bearer pc-token-1" },
  body: {
    event: "issue_created",
    issue: {
      identifier: "FAV-33",
      title: "Implementierung: Telegram-Benachrichtigungen",
      status: "todo",
      priority: "medium",
      actor: "CTO",
      url: "https://paperclip.local/issues/FAV-33",
      createdAt: "2026-05-07T22:00:00.000Z",
      updatedAt: "2026-05-07T22:00:00.000Z",
    },
  },
});

if (response.status !== 200 || !response.body.ok) {
  throw new Error(`Expected notifier success, got status=${response.status}`);
}

if (!sentPayloads[0] || sentPayloads[0].chat_id !== "5551") {
  throw new Error("Expected Telegram chat_id=5551");
}

if (!String(sentPayloads[0].text || "").includes("FAV-33")) {
  throw new Error("Expected notification text to include issue identifier");
}
if (!String(sentPayloads[0].text || "").includes("Issue erstellt")) {
  throw new Error("Expected created confirmation text marker");
}
if (attempts !== 2) {
  throw new Error(`Expected one retry, got attempts=${attempts}`);
}
if (!duplicateCreated.body?.skipped || duplicateCreated.body?.reason !== "duplicate_event") {
  throw new Error("Expected duplicate created event to be skipped");
}

const approvalRequired = await notifier({
  method: "POST",
  path: "/paperclip/issues/events",
  headers: { authorization: "Bearer pc-token-1" },
  body: {
    event: "issue_status_changed",
    transition: { from: "in_progress", to: "in_review" },
    issue: {
      identifier: "FAV-35",
      title: "Needs board approval",
      status: "in_review",
      priority: "high",
      actor: "CTO",
      realityGateComplete: true,
      proofGateComplete: true,
      executionState: { currentStageType: "approval" },
    },
  },
});

if (approvalRequired.status !== 200 || !approvalRequired.body.ok) {
  throw new Error(`Expected approval-required notifier success, got status=${approvalRequired.status}`);
}

const done = await notifier({
  method: "POST",
  path: "/paperclip/issues/events",
  headers: { authorization: "Bearer pc-token-1" },
  body: {
    event: "issue_status_changed",
    transition: { from: "in_review", to: "done" },
    issue: {
      identifier: "FAV-36",
      title: "Completed item",
      status: "done",
      priority: "medium",
      actor: "CTO",
      realityGateComplete: true,
      proofGateComplete: true,
    },
  },
});

if (done.status !== 200 || !done.body.ok) {
  throw new Error(`Expected completion notifier success, got status=${done.status}`);
}

const approvalPayload = sentPayloads.find((payload) => String(payload?.text || "").includes("FAV-35"));
const donePayload = sentPayloads.find((payload) => String(payload?.text || "").includes("FAV-36"));

if (!String(donePayload?.text || "").includes("Nach: done")) {
  throw new Error("Expected status change confirmation text for done case");
}

if (!String(approvalPayload?.text || "").includes("Statuswechsel")) {
  throw new Error("Expected status change confirmation text marker");
}

if (!String(donePayload?.text || "").includes("Statuswechsel")) {
  throw new Error("Expected status change confirmation text marker for done");
}

const filtered = await notifier({
  method: "POST",
  path: "/paperclip/issues/events/",
  headers: { authorization: "Bearer pc-token-1" },
  body: {
    issue: {
      identifier: "FAV-34",
      title: "Filtered status test",
      status: "todo",
      priority: "low",
      actor: "CTO",
    },
  },
});

if (!filtered.body?.skipped || filtered.body?.reason !== "event_filtered") {
  throw new Error("Expected event filter to skip notification");
}

const otherEvent = await notifier({
  method: "POST",
  path: "/paperclip/issues/events",
  headers: { authorization: "Bearer pc-token-1" },
  body: {
    event: "issue_comment_added",
    issue: {
      identifier: "FAV-37",
      title: "Comment only",
      status: "in_progress",
      priority: "low",
      actor: "CTO",
    },
  },
});

if (!otherEvent.body?.skipped || otherEvent.body?.reason !== "event_filtered") {
  throw new Error("Expected non-create/status-change events to be filtered");
}

console.log(JSON.stringify({
  smoke: "pass",
  scenario: "issue-event-notification",
  blockedTransitionStatus: blockedTransition.status,
  chatId: sentPayloads[0].chat_id,
  attempts,
  actions: [
    String(approvalPayload?.text || "").includes("Statuswechsel") ? "status_changed" : "missing",
    String(donePayload?.text || "").includes("Statuswechsel") ? "completed_status_changed" : "missing",
  ],
}, null, 2));
