type TelegramPayload = {
  title: string;
  message: string;
};

type TelegramDocumentPayload = {
  title: string;
  message: string;
  filename: string;
  document: Blob | ArrayBuffer | Uint8Array;
};

type LowStockItem = {
  name: string;
  stock: number;
  code?: string | null;
  extra?: string | null;
};

const escapeTelegramHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildTelegramText = (title: string, message: string) => {
  const safeTitle = escapeTelegramHtml(title);
  const safeMessage = escapeTelegramHtml(message);
  return `<b>${safeTitle}</b>\n${safeMessage}`;
};

async function sendTelegramRequest(body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...body,
    }),
  });

  return {
    ok: response.ok,
    status: response.status,
  };
}

export async function notifyTelegram({ title, message }: TelegramPayload) {
  return sendTelegramRequest({
    text: buildTelegramText(title, message),
  });
}

// Helper function to safely convert any document input to a Blob
function documentToBlob(document: Blob | ArrayBuffer | Uint8Array): Blob {
  // If it's already a Blob, return as is
  if (document instanceof Blob) {
    return document;
  }
  
  // Handle Uint8Array
  if (document instanceof Uint8Array) {
    // Convert Uint8Array to regular ArrayBuffer by creating a new one
    const newBuffer = new ArrayBuffer(document.byteLength);
    const view = new Uint8Array(newBuffer);
    view.set(document);
    return new Blob([view], { type: "application/pdf" });
  }
  
  // Handle ArrayBuffer
  if (document instanceof ArrayBuffer) {
    return new Blob([document], { type: "application/pdf" });
  }
  
  // Fallback for any other type (should not happen)
  return new Blob([document], { type: "application/pdf" });
}

export async function sendTelegramDocument({ title, message, filename, document }: TelegramDocumentPayload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, skipped: true };
  }

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("caption", buildTelegramText(title, message));
  formData.append("parse_mode", "HTML");
  
  // Convert document to Blob safely
  const blob = documentToBlob(document);
  formData.append("document", blob, filename);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: formData,
  });

  return {
    ok: response.ok,
    status: response.status,
  };
}

export async function notifyLowStockTelegram({
  title,
  items,
}: {
  title: string;
  items: LowStockItem[];
}) {
  if (!items.length) {
    return { ok: false, skipped: true };
  }

  const message = [
    `Jumlah item menipis: ${items.length}`,
    "",
    ...items.map((item, index) => {
      const codeLine = item.code ? `\nKode: ${item.code}` : "";
      const extraLine = item.extra ? `\n${item.extra}` : "";
      return `${index + 1}. ${item.name}${codeLine}\nSisa stok: ${item.stock}${extraLine}`;
    }),
  ].join("\n");

  return notifyTelegram({ title, message });
}