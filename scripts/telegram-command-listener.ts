import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { processTelegramUpdate, type TelegramUpdate } from "@/lib/telegram-commands";

type ListenerState = {
  lastUpdateId?: number;
  lastCheckedAt?: string;
  lastError?: string;
};

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const POLL_TIMEOUT_SECONDS = Number(process.env.TELEGRAM_COMMAND_POLL_TIMEOUT_SECONDS || 30);
const RECONNECT_DELAY_MS = Number(process.env.TELEGRAM_COMMAND_RECONNECT_DELAY_MS || 5_000);
const STATE_DIR = path.join(process.cwd(), ".cache");
const STATE_FILE = path.join(STATE_DIR, "telegram-command-state.json");

let state: ListenerState = {};

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadState() {
  try {
    const content = await readFile(STATE_FILE, "utf8");
    state = JSON.parse(content) as ListenerState;
  } catch {
    state = {};
  }
}

async function saveState(nextState: ListenerState) {
  state = nextState;
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function deleteWebhook() {
  if (!TOKEN) return;
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/deleteWebhook?drop_pending_updates=false`, {
    method: "POST",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`deleteWebhook failed: ${response.status} ${text}`);
  }
}

async function pollUpdates(offset?: number) {
  if (!TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diisi");
  }

  const params = new URLSearchParams({
    timeout: String(POLL_TIMEOUT_SECONDS),
    allowed_updates: JSON.stringify(["message", "edited_message"]),
  });

  if (offset !== undefined) {
    params.set("offset", String(offset));
  }

  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`getUpdates failed: ${response.status} ${text}`);
  }

  return (await response.json()) as {
    ok: boolean;
    result: TelegramUpdate[];
  };
}

async function handleBatch(updates: TelegramUpdate[]) {
  for (const update of updates) {
    await processTelegramUpdate(update);
  }
}

async function main() {
  const reconnectDelayMs = parseNumber(process.env.TELEGRAM_COMMAND_RECONNECT_DELAY_MS, RECONNECT_DELAY_MS);
  await loadState();

  console.log("[telegram-command] switching bot to polling mode...");
  await deleteWebhook();
  console.log(`[telegram-command] listening with long polling, timeout=${POLL_TIMEOUT_SECONDS}s`);

  while (true) {
    const offset = typeof state.lastUpdateId === "number" ? state.lastUpdateId + 1 : undefined;

    try {
      const payload = await pollUpdates(offset);
      const updates = payload.result || [];

      if (updates.length > 0) {
        await handleBatch(updates);
        await saveState({
          lastUpdateId: updates[updates.length - 1]?.update_id,
          lastCheckedAt: new Date().toISOString(),
          lastError: undefined,
        });
      } else {
        await saveState({
          ...state,
          lastCheckedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error("[telegram-command] poll failed:", message);
      await saveState({
        ...state,
        lastCheckedAt: new Date().toISOString(),
        lastError: message,
      });
      await new Promise((resolve) => setTimeout(resolve, reconnectDelayMs));
    }
  }
}

main().catch((error) => {
  console.error("[telegram-command] fatal:", error);
  process.exit(1);
});
