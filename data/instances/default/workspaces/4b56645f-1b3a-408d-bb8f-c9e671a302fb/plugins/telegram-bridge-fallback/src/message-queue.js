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
  return queue.find((item) => !item.acknowledged) || null;
}

function acknowledge(id) {
  const item = queue.find((entry) => entry.id === id);
  if (!item) return false;

  item.acknowledged = true;
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
  stats,
};
