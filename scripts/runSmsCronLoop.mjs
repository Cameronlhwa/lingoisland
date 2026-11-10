import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const secret = process.env.CRON_SECRET?.trim();
const url = process.env.SMS_CRON_URL?.trim() || "http://localhost:3002/api/cron/sms-process";
const intervalMs = Number(process.env.SMS_CRON_INTERVAL_MS || 300_000);

if (!secret) {
  console.error("CRON_SECRET is not configured in .env.local");
  process.exit(1);
}

if (!Number.isFinite(intervalMs) || intervalMs < 30_000) {
  console.error("SMS_CRON_INTERVAL_MS must be at least 30000");
  process.exit(1);
}

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(60_000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`SMS cron returned ${response.status}`);
    }
    console.log(`[sms-cron] ${new Date().toISOString()}`, JSON.stringify(body));
  } catch (error) {
    console.error(
      `[sms-cron] ${new Date().toISOString()} failed:`,
      error instanceof Error ? error.message : "unknown error",
    );
  } finally {
    running = false;
  }
}

console.log(`[sms-cron] Running ${url} every ${Math.round(intervalMs / 1000)} seconds.`);
void tick();
const timer = setInterval(() => void tick(), intervalMs);

function stop() {
  clearInterval(timer);
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
