import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/notifications";

const TIME_ZONE = "Asia/Jakarta";

type ReportBucketKey = "HANDPHONE" | "AKSESORIS" | "VOUCHER" | "PULSA";

type ReportBucket = {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  transactionIds: Set<string>;
  itemCount: number;
};

export type DailyReportSnapshot = {
  dateKey: string;
  dateLabel: string;
  buckets: Record<ReportBucketKey, ReportBucket>;
  totals: {
    revenue: number;
    cost: number;
    profit: number;
    transactionCount: number;
    itemCount: number;
  };
};

const bucketLabels: Record<ReportBucketKey, string> = {
  HANDPHONE: "Handphone",
  AKSESORIS: "Aksesoris",
  VOUCHER: "Voucher",
  PULSA: "Pulsa",
};

function money(value: number) {
  return `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
}

function signedMoney(value: number) {
  return value < 0 ? `-Rp ${Math.round(Math.abs(value)).toLocaleString("id-ID")}` : money(value);
}

function getJakartaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "0";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

export function getJakartaDateKey(date = new Date()) {
  const { year, month, day } = getJakartaDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getJakartaDateLabel(date = new Date()) {
  const { year, month, day } = getJakartaDateParts(date);
  const formatted = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
  return formatted;
}

function getJakartaDayRange(date = new Date()) {
  const { year, month, day } = getJakartaDateParts(date);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - 7 * 60 * 60 * 1000);
  return { start, end };
}

function createBuckets(): Record<ReportBucketKey, ReportBucket> {
  return {
    HANDPHONE: { label: bucketLabels.HANDPHONE, revenue: 0, cost: 0, profit: 0, transactionIds: new Set(), itemCount: 0 },
    AKSESORIS: { label: bucketLabels.AKSESORIS, revenue: 0, cost: 0, profit: 0, transactionIds: new Set(), itemCount: 0 },
    VOUCHER: { label: bucketLabels.VOUCHER, revenue: 0, cost: 0, profit: 0, transactionIds: new Set(), itemCount: 0 },
    PULSA: { label: bucketLabels.PULSA, revenue: 0, cost: 0, profit: 0, transactionIds: new Set(), itemCount: 0 },
  };
}

function buildItemBucket(item: {
  phone?: { brand: string; type: string } | null;
  accessory?: { name: string } | null;
  voucher?: { name: string } | null;
  pulsa?: { denomination: number } | null;
  pulsaDestinationNumber?: string | null;
}) {
  if (item.phone) return "HANDPHONE" as const;
  if (item.accessory) return "AKSESORIS" as const;
  if (item.voucher) return "VOUCHER" as const;
  if (item.pulsa || item.pulsaDestinationNumber) return "PULSA" as const;
  return null;
}

export async function getDailyReportSnapshot(date = new Date()) {
  const { start, end } = getJakartaDayRange(date);
  const dateKey = getJakartaDateKey(date);
  const dateLabel = getJakartaDateLabel(date);

  const transactions = await prisma.transaction.findMany({
    where: {
      type: "SALE",
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      items: {
        include: {
          phone: {
            select: { brand: true, type: true },
          },
          accessory: {
            select: { name: true },
          },
          voucher: {
            select: { name: true },
          },
          pulsa: {
            select: { denomination: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const buckets = createBuckets();
  const uniqueTransactions = new Set<string>();

  for (const transaction of transactions) {
    uniqueTransactions.add(transaction.id);

    for (const item of transaction.items) {
      const bucketKey = buildItemBucket(item);
      if (!bucketKey) continue;

      const quantity = Number(item.quantity || 1);
      const revenue = Number(item.sellPrice || 0) * quantity;
      const cost = Number(item.costPrice || 0) * quantity;
      const profit = revenue - cost;

      const bucket = buckets[bucketKey];
      bucket.revenue += revenue;
      bucket.cost += cost;
      bucket.profit += profit;
      bucket.transactionIds.add(transaction.id);
      bucket.itemCount += quantity;
    }
  }

  const totals = Object.values(buckets).reduce(
    (acc, bucket) => {
      acc.revenue += bucket.revenue;
      acc.cost += bucket.cost;
      acc.profit += bucket.profit;
      acc.itemCount += bucket.itemCount;
      return acc;
    },
    {
      revenue: 0,
      cost: 0,
      profit: 0,
      transactionCount: uniqueTransactions.size,
      itemCount: 0,
    }
  );

  return {
    dateKey,
    dateLabel,
    buckets,
    totals,
  } satisfies DailyReportSnapshot;
}

export function formatDailyReportMessage(report: DailyReportSnapshot) {
  const lines = [
    `Laporan Harian ${report.dateLabel}`,
    "Waktu kirim: otomatis",
    "",
  ];

  Object.values(report.buckets).forEach((bucket) => {
    lines.push(
      `${bucket.label}`,
      `Omzet: ${money(bucket.revenue)}`,
      `Modal: ${money(bucket.cost)}`,
      `Laba/Rugi: ${signedMoney(bucket.profit)}`,
      `Transaksi: ${bucket.transactionIds.size}`,
      `Item: ${bucket.itemCount}`,
      ""
    );
  });

  lines.push(
    "TOTAL HARI INI",
    `Omzet: ${money(report.totals.revenue)}`,
    `Modal: ${money(report.totals.cost)}`,
    `Laba/Rugi: ${signedMoney(report.totals.profit)}`,
    `Transaksi: ${report.totals.transactionCount}`,
    `Item: ${report.totals.itemCount}`
  );

  return lines.join("\n");
}

export async function sendDailyReport(date = new Date()) {
  const report = await getDailyReportSnapshot(date);
  const message = formatDailyReportMessage(report);

  await notifyTelegram({
    title: `Daily Report ${report.dateLabel}`,
    message,
  });

  return report;
}
