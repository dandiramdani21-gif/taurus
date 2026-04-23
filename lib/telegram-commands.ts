import { prisma } from "@/lib/prisma";
import { buildInvoicePdfBuffer, type InvoicePdfItem } from "@/lib/invoice-pdf";
import { formatDailyReportMessage, getDailyReportSnapshot } from "@/lib/daily-report";

const LOW_STOCK_THRESHOLD = 3;

type TelegramMessage = {
  message_id?: number;
  chat?: {
    id?: number | string;
  };
  text?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

type TelegramCommandResult = {
  handled: boolean;
  command?: string;
};

function formatMoney(value: number) {
  return `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
}

function formatInvoiceNumber(transactionId: string) {
  return `INV-${transactionId.slice(-8).toUpperCase()}`;
}

function escapeTelegramText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildTelegramMessage(title: string, lines: string[]) {
  return `<b>${escapeTelegramText(title)}</b>\n${lines.map(escapeTelegramText).join("\n")}`;
}

function splitTelegramText(text: string, maxLength = 3500) {
  const chunks: string[] = [];
  let buffer = "";

  for (const line of text.split("\n")) {
    const nextBuffer = buffer ? `${buffer}\n${line}` : line;
    if (nextBuffer.length > maxLength) {
      if (buffer) {
        chunks.push(buffer);
      }
      buffer = line;
      continue;
    }

    buffer = nextBuffer;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

async function sendTelegramMessage(chatId: number | string, text: string, replyToMessageId?: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    }),
  });

  return { ok: response.ok, status: response.status };
}

async function sendTelegramPlainMessage(chatId: number | string, text: string, replyToMessageId?: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    }),
  });

  return { ok: response.ok, status: response.status };
}

async function sendTelegramDocument(
  chatId: number | string,
  { title, message, filename, document }: { title: string; message: string; filename: string; document: Blob | ArrayBuffer | Uint8Array }
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, skipped: true };
  }

  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  formData.append("caption", buildTelegramMessage(title, [message]));
  formData.append("parse_mode", "HTML");

  const blob = document instanceof Blob ? document : new Blob([document], { type: "application/pdf" });
  formData.append("document", blob, filename);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: formData,
  });

  return { ok: response.ok, status: response.status };
}

function normalizeCommand(text: string) {
  return text.trim().split(/\s+/)[0]?.toLowerCase().split("@")[0] || "";
}

async function getLowStockSummary() {
  const [phones, accessories, vouchers] = await Promise.all([
    prisma.phone.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { brand: true, type: true, imei: true, stock: true },
      orderBy: { stock: "asc" },
    }),
    prisma.accessory.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { name: true, code: true, stock: true },
      orderBy: { stock: "asc" },
    }),
    prisma.voucher.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { name: true, code: true, stock: true },
      orderBy: { stock: "asc" },
    }),
  ]);

  return [
    ...phones.map((item) => ({
      category: "Handphone",
      name: `${item.brand} ${item.type}`,
      code: item.imei,
      stock: item.stock,
    })),
    ...accessories.map((item) => ({
      category: "Aksesoris",
      name: item.name,
      code: item.code,
      stock: item.stock,
    })),
    ...vouchers.map((item) => ({
      category: "Voucher",
      name: item.name,
      code: item.code,
      stock: item.stock,
    })),
  ].sort((a, b) => a.stock - b.stock);
}

async function getLatestInvoiceData() {
  return prisma.transaction.findFirst({
    where: { type: "SALE" },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
      items: {
        include: {
          phone: { select: { brand: true, type: true, imei: true, color: true } },
          accessory: { select: { name: true, code: true } },
          voucher: { select: { name: true, code: true } },
          pulsa: { select: { denomination: true, code: true, destinationNumber: true, description: true, note: true, balance: true } },
        },
      },
    },
  });
}

function getInvoiceCategoryLabel(transaction: NonNullable<Awaited<ReturnType<typeof getLatestInvoiceData>>>) {
  const hasPhone = transaction.items.some((item) => !!item.phone);
  const hasAccessory = transaction.items.some((item) => !!item.accessory);
  const hasVoucher = transaction.items.some((item) => !!item.voucher);
  const hasPulsa = transaction.items.some((item) => !!item.pulsa);

  if (hasPhone) return "Handphone";
  if (hasAccessory) return "Aksesoris";
  if (hasVoucher) return "Voucher";
  if (hasPulsa) return "Pulsa";
  return transaction.category;
}

function buildInvoiceItems(
  transaction: NonNullable<Awaited<ReturnType<typeof getLatestInvoiceData>>>
): InvoicePdfItem[] {
  return transaction.items
    .map((item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.sellPrice || 0);

      if (item.phone) {
        return {
          name: `${item.phone.brand} ${item.phone.type}`,
          code: item.phone.imei,
          detail: item.phone.color ? `Warna: ${item.phone.color}` : null,
          quantity,
          unitPrice,
          total: unitPrice * quantity,
        };
      }

      if (item.accessory) {
        return {
          name: item.accessory.name,
          code: item.accessory.code,
          quantity,
          unitPrice,
          total: unitPrice * quantity,
        };
      }

      if (item.voucher) {
        return {
          name: item.voucher.name,
          code: item.voucher.code,
          quantity,
          unitPrice,
          total: unitPrice * quantity,
        };
      }

      if (item.pulsa) {
        return {
          name: item.pulsa.description || item.pulsa.note || `Pulsa ${item.pulsa.denomination}`,
          code: item.pulsa.destinationNumber || item.pulsa.code || "-",
          detail: item.pulsa.balance !== null && item.pulsa.balance !== undefined ? `Saldo: ${formatMoney(Number(item.pulsa.balance))}` : null,
          quantity,
          unitPrice,
          total: unitPrice * quantity,
        };
      }

      return null;
    })
    .filter((item): item is InvoicePdfItem => Boolean(item));
}

async function handleHelp(chatId: number | string, replyToMessageId?: number) {
  return sendTelegramMessage(
    chatId,
    buildTelegramMessage("Command tersedia", [
      "/help - bantuan",
      "/stok - stok menipis",
      "/laporan - laba rugi hari ini",
      "/invoice - invoice terakhir",
    ]),
    replyToMessageId
  );
}

async function handleStock(chatId: number | string, replyToMessageId?: number) {
  const items = await getLowStockSummary();
  if (items.length === 0) {
    return sendTelegramMessage(chatId, "Stok menipis\nSemua produk masih aman.", replyToMessageId);
  }

  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const list = grouped.get(item.category) || [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const lines = [`Batas: <= ${LOW_STOCK_THRESHOLD}`];
  for (const [category, group] of grouped.entries()) {
    lines.push("", `[${category}] (${group.length})`);
    group.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.name}`, `Kode: ${item.code}`, `Sisa stok: ${item.stock}`);
    });
  }

  const chunks = splitTelegramText(`Stok menipis\n${lines.join("\n")}`);
  for (let index = 0; index < chunks.length; index += 1) {
    await sendTelegramPlainMessage(chatId, chunks[index], index === 0 ? replyToMessageId : undefined);
  }

  return { ok: true, chunks: chunks.length };
}

async function handleReport(chatId: number | string, replyToMessageId?: number) {
  const report = await getDailyReportSnapshot(new Date());
  return sendTelegramMessage(
    chatId,
    buildTelegramMessage("Laporan Hari Ini", [formatDailyReportMessage(report)]),
    replyToMessageId
  );
}

async function handleInvoice(chatId: number | string, replyToMessageId?: number) {
  const transaction = await getLatestInvoiceData();

  if (!transaction) {
    return sendTelegramMessage(chatId, buildTelegramMessage("Invoice terakhir", ["Belum ada transaksi."]), replyToMessageId);
  }

  const invoiceNumber = formatInvoiceNumber(transaction.id);
  const invoiceLabel = getInvoiceCategoryLabel(transaction);
  const invoicePdf = buildInvoicePdfBuffer({
    invoiceNumber,
    invoiceDate: new Date(transaction.createdAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }),
    storeName: "Taurus Cellular",
    storeAddressLines: [
      "Jl. Raya Tanjungsari No.129",
      "Kec. Tanjungsari, Kabupaten Sumedang",
      "Jawa Barat, 45362",
      "0857-5902-5901",
    ],
    categoryLabel: invoiceLabel,
    items: buildInvoiceItems(transaction),
    totalAmount: Number(transaction.totalAmount || 0),
    totalCost: Number(transaction.totalCost || 0),
    profit: Number(transaction.profit || 0),
    notes: [`Kasir: ${transaction.user?.name || "-"}`],
    footer: "Terima kasih telah berbelanja di Taurus Cellular.",
  });

  await sendTelegramDocument(chatId, {
    title: "Invoice terakhir",
    message: [
      `Invoice: ${invoiceNumber}`,
      `Total: ${formatMoney(Number(transaction.totalAmount || 0))}`,
      `Kategori: ${invoiceLabel}`,
    ].join("\n"),
    filename: `${invoiceNumber}.pdf`,
    document: invoicePdf,
  });

  return sendTelegramMessage(
    chatId,
    buildTelegramMessage("Invoice terakhir", [
      `Invoice: ${invoiceNumber}`,
      `Total: ${formatMoney(Number(transaction.totalAmount || 0))}`,
      `Kategori: ${invoiceLabel}`,
      "PDF invoice sudah dikirim.",
    ]),
    replyToMessageId
  );
}

export async function processTelegramUpdate(update: TelegramUpdate): Promise<TelegramCommandResult> {
  const message = update.message ?? update.edited_message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id;

  if (!text || chatId === undefined || chatId === null) {
    return { handled: false };
  }

  const command = normalizeCommand(text);
  const replyToMessageId = message.message_id;

  if (command === "/start" || command === "/help") {
    await handleHelp(chatId, replyToMessageId);
    return { handled: true, command };
  }

  if (command === "/stok" || command === "/stock") {
    await handleStock(chatId, replyToMessageId);
    return { handled: true, command };
  }

  if (command === "/laporan") {
    await handleReport(chatId, replyToMessageId);
    return { handled: true, command };
  }

  if (command === "/invoice") {
    await handleInvoice(chatId, replyToMessageId);
    return { handled: true, command };
  }

  if (command.startsWith("/")) {
    await sendTelegramMessage(
      chatId,
      buildTelegramMessage("Command tidak dikenal", ["Ketik /help untuk melihat command yang tersedia."]),
      replyToMessageId
    );
    return { handled: true, command };
  }

  return { handled: false };
}
