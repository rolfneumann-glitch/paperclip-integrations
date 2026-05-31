"use strict";

const crypto = require("crypto");

const queue = [];

function enqueue(event) {
  const eventId = String(event?.eventId || "").trim();

  if (eventId) {
    const existing = queue.find((item) => item.eventId === eventId);
    if (existing) return existing;
  }

  const item = {
    id: crypto.randomUUID(),
    eventId,
    receivedAt: new Date().toISOString(),
    acknowledged: false,
    event,
  };

  queue.push(item);

  return item;
}

function getNext() {
  const item = queue.find((entry) => !entry.acknowledged && !entry.processing) || null;
  if (!item) return null;

  item.processing = true;
  item.processingStartedAt = new Date().toISOString();

  return item;
}

function acknowledge(id) {
  const item = queue.find((entry) => entry.id === id);
  if (!item) return false;

  item.acknowledged = true;
  item.processing = false;
  item.acknowledgedAt = new Date().toISOString();

  return true;
}

function release(id) {
  const item = queue.find((entry) => entry.id === id);
  if (!item) return false;

  item.processing = false;
  item.lastReleasedAt = new Date().toISOString();

  return true;
}

function stats() {
  return {
    total: queue.length,
    pending: queue.filter((x) => !x.acknowledged).length,
  };
}

module.exports = {
  enqueue,
  getNext,
  acknowledge,
  release,
  stats,
};
