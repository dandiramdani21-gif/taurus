import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getJakartaDateKey, sendDailyReport } from "@/lib/daily-report";

type SchedulerState = {
  lastSentDateKey?: string;
  lastCheckedAt?: string;
  lastError?: string;
};

const STATE_DIR = path.join(process.cwd(), ".cache");
const STATE_FILE = path.join(STATE_DIR, "daily-report-state.json");

let state: SchedulerState = {};
let running = false;

function parseConfigNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const reportHour = parseConfigNumber(process.env.DAILY_REPORT_HOUR, 22);
const reportMinute = parseConfigNumber(process.env.DAILY_REPORT_MINUTE, 18);
const checkIntervalMs = parseConfigNumber(process.env.DAILY_REPORT_CHECK_INTERVAL_MS, 60_000);

async function loadState() {
  try {
    const content = await readFile(STATE_FILE, "utf8");
    state = JSON.parse(content) as SchedulerState;
  } catch {
    state = {};
  }
}

async function saveState(nextState: SchedulerState) {
  state = nextState;
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function isDue(now: Date) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  return hour > reportHour || (hour === reportHour && minute >= reportMinute);
}

async function checkAndSend() {
  if (running) return;

  const now = new Date();
  const dateKey = getJakartaDateKey(now);

  if (state.lastSentDateKey === dateKey) {
    state.lastCheckedAt = now.toISOString();
    await saveState({ ...state });
    return;
  }

  if (!isDue(now)) {
    state.lastCheckedAt = now.toISOString();
    await saveState({ ...state });
    return;
  }

  running = true;
  try {
    console.log(`[daily-report] sending report for ${dateKey}...`);
    await sendDailyReport(now);
    await saveState({
      lastSentDateKey: dateKey,
      lastCheckedAt: now.toISOString(),
      lastError: undefined,
    });
    console.log(`[daily-report] report sent for ${dateKey}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[daily-report] failed:", message);
    await saveState({
      ...state,
      lastCheckedAt: now.toISOString(),
      lastError: message,
    });
  } finally {
    running = false;
  }
}

async function main() {
  await loadState();
  console.log(
    `[daily-report] listening every ${Math.round(checkIntervalMs / 1000)}s, target hour=${reportHour}, minute=${reportMinute}`
  );

  await checkAndSend();
  setInterval(() => {
    void checkAndSend();
  }, checkIntervalMs);
}

main().catch((error) => {
  console.error("[daily-report] fatal:", error);
  process.exit(1);
});
