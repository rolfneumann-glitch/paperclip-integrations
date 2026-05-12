#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$PLUGIN_DIR"
node test/smoke.mjs
node test/webhook-direct-fixed-secret-smoke.mjs
node test/server-ceo-path-dispatch-smoke.mjs
node test/ceo-intake-smoke.mjs
node test/telegram-intake-workflow.mjs
node test/route-forwarding-smoke.mjs
node test/issue-events-smoke.mjs
node test/host-allowlist-smoke.mjs
