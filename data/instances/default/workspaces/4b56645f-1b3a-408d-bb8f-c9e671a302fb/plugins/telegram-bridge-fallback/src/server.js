"use strict";

const http = require("node:http");
const { execFile } = require("node:child_process");
const { URL } = require("node:url");
const { createBridge, getAcceptedWebhookPaths, normalizePath } = require("./bridge");
const { createIssueEventNotifier, sendTelegramMessage } = require("./issue-notifier");
const { createCeoRouteHandler } = require("./route-handler");
const {
  createCeoIntakeHandler,
  getIntakeConfig,
  resolveCeoAgentId,
  createIssue,
  sendAck,
  splitTelegramText,
} = require("./ceo-intake");
const messageQueue = require("./message-queue");

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



async function transcribeAudio(audioPath) {
  return await new Promise((resolve, reject) => {
    execFile(
      "python3",
      [
        "/app/plugins/telegram-bridge-fallback/src/transcribe.py",
        audioPath
      ],
      {
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`transcribe_failed:${stderr || error.message}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error(`invalid_transcribe_json:${stdout}`));
        }
      }
    );
  });
}

async function downloadTelegramAudio({ event, env, fetchImpl = fetch }) {
  const raw = event?.payload?.raw?.message || {};
  const audio = raw.voice || raw.audio || null;
  const fileId = audio?.file_id || "";
  if (!fileId) return null;

  const botToken = env.TELEGRAM_BOT_TOKEN || "";
  if (!botToken) throw new Error("missing_telegram_bot_token");

  const fileInfoResponse = await fetchImpl(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  const fileInfo = await fileInfoResponse.json();

  if (!fileInfo?.ok || !fileInfo?.result?.file_path) {
    throw new Error(`telegram_getFile_failed:${JSON.stringify(fileInfo)}`);
  }

  const filePath = fileInfo.result.file_path;
  const fileName = filePath.split("/").pop() || `${fileId}.oga`;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  const fs = require("node:fs/promises");
  const path = require("node:path");

  const dir = env.TELEGRAM_AUDIO_DIR || "/app/data/telegram-audio";
  await fs.mkdir(dir, { recursive: true });

  const localName = `${event.updateId || Date.now()}-${safeName}`;
  const localPath = path.join(dir, localName);

  const downloadResponse = await fetchImpl(
    `https://api.telegram.org/file/bot${botToken}/${filePath}`
  );

  if (!downloadResponse.ok) {
    throw new Error(`telegram_audio_download_failed:${downloadResponse.status}`);
  }

  const buffer = Buffer.from(await downloadResponse.arrayBuffer());
  await fs.writeFile(localPath, buffer);

  return {
    localPath,
    filePath,
    fileId,
    fileUniqueId: audio?.file_unique_id || "",
    fileSize: audio?.file_size || fileInfo?.result?.file_size || buffer.length,
    mimeType: audio?.mime_type || "",
    duration: audio?.duration || "",
  };
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
      if (normalizedPath === "/telegram/send" && String(req.method || "").toUpperCase() === "POST") {
        const auth = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
        const token = env.TELEGRAM_SEND_TOKEN || env.PAPERCLIP_WEBHOOK_TOKEN || "";
        if (!token) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "missing_send_token" }));
          return;
        }
        if (auth !== token) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
          return;
        }

        try {
          const text = String(body.text || "").trim();
          const chatId = String(body.chat_id || env.TELEGRAM_NOTIFY_CHAT_ID || env.TELEGRAM_ALLOWED_CHAT_ID || "").trim();

          if (!text) {
            res.writeHead(400, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "missing_text" }));
            return;
          }

          const result = await sendTelegramMessage({
            botToken: env.TELEGRAM_BOT_TOKEN || "",
            chatId,
            text,
            fetchImpl: fetch,
          });

          logger.log("[telegram-bridge] telegram send success", { chatId, messageId: result?.result?.message_id });
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true, result }));
          return;
        } catch (err) {
          logger.error("[telegram-bridge] telegram send failed", { error: err?.message || String(err) });
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: err?.message || String(err) }));
          return;
        }
      }


      if (normalizedPath === "/telegram/messages/next" && String(req.method || "").toUpperCase() === "GET") {
        const item = messageQueue.getNext();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, message: item }));
        return;
      }

      const ackMatch = normalizedPath.match(/^\/telegram\/messages\/([^/]+)\/ack$/);
      if (ackMatch && String(req.method || "").toUpperCase() === "POST") {
        const acknowledged = messageQueue.acknowledge(ackMatch[1]);
        res.writeHead(acknowledged ? 200 : 404, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: acknowledged, acknowledged }));
        return;
      }

      if (normalizedPath === "/telegram/messages/stats" && String(req.method || "").toUpperCase() === "GET") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, stats: messageQueue.stats() }));
        return;
      }

      if (normalizedPath === "/telegram/messages/process-next" && String(req.method || "").toUpperCase() === "POST") {
        const item = messageQueue.getNext();

        if (!item) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true, processed: false, reason: "queue_empty" }));
          return;
        }

        try {
          const cfg = getIntakeConfig(env);

          let text = String(item?.event?.payload?.text || "").trim();

          let audioInfo = null;
          let transcription = null;

          if (item?.event?.payload?.type === "audio") {
            audioInfo = await downloadTelegramAudio({ event: item.event, env, fetchImpl: fetch });

            if (audioInfo?.localPath) {
              transcription = await transcribeAudio(audioInfo.localPath);
              if (transcription?.text) {
                text = String(transcription.text || "").trim();
              }
            }
          }

          const parsedText = splitTelegramText(text);

          const audioDescription = audioInfo
            ? [
                transcription?.text
                  ? [
                      "Transkript:",
                      transcription.text,
                      ""
                    ].join("\n")
                  : "",
                "Audio-Datei:",
                audioInfo.localPath,
                "",
                "Audio-Metadaten:",
                `- fileId: ${audioInfo.fileId}`,
                `- fileUniqueId: ${audioInfo.fileUniqueId}`,
                `- mimeType: ${audioInfo.mimeType}`,
                `- duration: ${audioInfo.duration}`,
                `- fileSize: ${audioInfo.fileSize}`,
                `- telegramFilePath: ${audioInfo.filePath}`,
              ].filter(Boolean).join("\n")
            : "";

          const issueInput = {
            text,
            source: "telegram",
            route: "ceo",
            telegram: {
              chatId: String(item?.event?.payload?.chatId || ""),
              userId: String(item?.event?.payload?.userId || ""),
            },
            raw: item.event,
          };

          let assigneeAgentId;

          if (item?.event?.payload?.type === "image") {
            assigneeAgentId = cfg.imageAgentId || await resolveCeoAgentId(cfg, fetch);
          } else {
            assigneeAgentId = await resolveCeoAgentId(cfg, fetch);
          }

          const workflow = "ceo-queue";

          const issue = await createIssue(
            cfg,
            assigneeAgentId,
            {
              ...issueInput,
              text: parsedText.title || (audioInfo ? "Audio-Nachricht aus Telegram" : ""),
              additionalDescription: [parsedText.description, audioDescription].filter(Boolean).join("\n\n"),
            },
            workflow,
            fetch
          );

          await sendAck(cfg, issueInput, issue, fetch);

          messageQueue.acknowledge(item.id);

          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({
            ok: true,
            processed: true,
            issueId: issue?.id || null,
            identifier: issue?.identifier || null,
            queueMessageId: item.id,
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : "internal_error";
          logger.error("[telegram-bridge] process-next failed", {
            queueMessageId: item?.id,
            eventId: item?.eventId,
            error: message,
          });
          if (item?.id) messageQueue.release(item.id);

          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({
            ok: false,
            error: message,
          }));
        }

        return;
      }

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
