"use strict";

const fs = require("fs");
const path = require("path");

function textOf(event) {
  return String(
    event?.payload?.text ||
    event?.text ||
    event?.raw?.message?.caption ||
    event?.payload?.raw?.message?.caption ||
    event?.message?.caption ||
    event?.message?.text ||
    ""
  ).trim();
}

function hasWertKeyword(event) {
  return /\bwert\b/i.test(textOf(event));
}

function rawMessage(event) {
  return (
    event?.payload?.raw?.message ||
    event?.raw?.message ||
    event?.message ||
    {}
  );
}

function hasImage(event) {
  const msg = rawMessage(event);
  return Array.isArray(msg.photo) && msg.photo.length > 0;
}

function bestPhotoFileId(event) {
  const photos = rawMessage(event).photo || [];
  if (!photos.length) return "";
  const best = photos.slice().sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
  return best.file_id || "";
}

async function telegramApi(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {})
  });

  const json = await res.json();
  if (!json.ok) throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  return json.result;
}

async function downloadImage(event) {
  const fileId = bestPhotoFileId(event);
  if (!fileId) throw new Error("no telegram photo file_id");

  const file = await telegramApi("getFile", { file_id: fileId });
  const token = process.env.TELEGRAM_BOT_TOKEN;

  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);

  const ext = path.extname(file.file_path || "") || ".jpg";
  const dir = "/app/data/telegram-media/gutachter";
  fs.mkdirSync(dir, { recursive: true });

  const filename = `wert-${Date.now()}-${fileId.replace(/[^a-zA-Z0-9_-]/g, "_")}${ext}`;
  const target = path.join(dir, filename);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(target, buffer);

  return target;
}

async function buildGutachterIssue(event) {
  const imagePath = await downloadImage(event);
  const hint = textOf(event).replace(/\bwert\b/ig, "").trim();

  return {
    title: "Gutachten erstellen",
    description:
      "Auftrag:\n" +
      "Objekt auf dem Bild erkennen, Gutachten erstellen, realistischen Preisbereich ermitteln und eine kurze Telegram-Zusammenfassung in einem neuen Issue an den Telegram-Agenten übergeben.\n\n" +
      `Bildpfad:\n${imagePath}\n\n` +
      (hint ? `Zusatzhinweis:\n${hint}\n\n` : "") +
      "Abschluss:\n" +
      "Nach Erstellung des Telegram-Agent-Issues das eigene Issue auf done setzen.",
    status: "todo",
    assigneeAgentId: process.env.GUTACHTER_AGENT_ID
  };
}

module.exports = {
  hasWertKeyword,
  hasImage,
  buildGutachterIssue
};
