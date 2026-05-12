import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const THIS_FILE = fileURLToPath(import.meta.url);
const TEST_DIR = dirname(THIS_FILE);
const PLUGIN_DIR = resolve(TEST_DIR, "..");

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      cwd: PLUGIN_DIR,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`script_failed:${scriptPath}:exit_${code}\n${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function extractLastJsonObject(output) {
  const text = String(output || "");
  const start = text.lastIndexOf("\n{");
  const jsonText = start >= 0 ? text.slice(start + 1).trim() : text.trim();
  return jsonText;
}

function parseJsonOutput(output, scenario) {
  const parsed = JSON.parse(extractLastJsonObject(output));
  if (parsed.smoke !== "pass") {
    throw new Error(`scenario_failed:${scenario}`);
  }
  return parsed;
}

const startedAt = new Date().toISOString();

const intakeRaw = await runNodeScript("test/ceo-intake-smoke.mjs");
const intake = parseJsonOutput(intakeRaw.stdout, "ceo-intake");
if (intake.scenario !== "ceo-intake") {
  throw new Error("unexpected_scenario:ceo-intake");
}
if (intake.unauthorizedStatus !== 401 || intake.nonBearerStatus !== 401 || intake.ackSent !== true) {
  throw new Error("ceo_intake_assertion_failed");
}

const authRaw = await runNodeScript("test/server-ceo-auth-smoke.mjs");
const auth = parseJsonOutput(authRaw.stdout, "server-ceo-auth");
if (auth.scenario !== "server-ceo-auth") {
  throw new Error("unexpected_scenario:server-ceo-auth");
}
if (auth.missingStatus !== 401 || auth.invalidStatus !== 401) {
  throw new Error("server_ceo_auth_assertion_failed");
}

console.log(JSON.stringify({
  smoke: "pass",
  scenario: "telegram-intake-workflow",
  timestamp: startedAt,
  checks: {
    ceoIntake: {
      unauthorizedStatus: intake.unauthorizedStatus,
      nonBearerStatus: intake.nonBearerStatus,
      createdIdentifier: intake.createdIdentifier,
      ackSent: intake.ackSent,
    },
    serverCeoAuth: {
      missingStatus: auth.missingStatus,
      invalidStatus: auth.invalidStatus,
    },
  },
}, null, 2));
