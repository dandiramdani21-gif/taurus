"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, subDays, startOfMonth } from "date-fns";
import * as XLSX from "xlsx";

type ReportProductFilter = "all" | "phone" | "accessory" | "voucher" | "pulsa";
type ReportCategory = "HANDPHONE" | "PRODUK_LAIN" | "PULSA";

type ReportTransaction = {
  id: string;
  createdAt: string;
  category?: ReportCategory;
  status: "PAID" | "REFUND";
  servedByName?: string | null;
  totalAmount: number;
  totalCost: number;
  profit: number;
  note?: string | null;
  items: Array<{
    id?: string;
    quantity: number;
    sellPrice: number;
    costPrice: number;
    pulsaDestinationNumber?: string | null;
    pulsaDescription?: string | null;
    pulsaBalance?: number | null;
    phone?: {
      brand: string;
      type: string;
      imei: string;
      color?: string | null;
      purchaseDate?: string | Date | null;
      purchasePrice: number;
      metadata?: Array<{ key: string; value: string }>;
    } | null;
    accessory?: {
      name: string;
      code: string;
    } | null;
    voucher?: {
      name: string;
      code: string;
    } | null;
    pulsa?: {
      denomination: number;
      note?: string | null;
      destinationNumber?: string | null;
      description?: string | null;
    } | null;
  }>;
};

type ReportRow = {
  key: string;
  dateKey: string;
  dateLabel: string;
  category: string;
  product: string;
  quantity: number;
  cost: number;
  revenue: number;
  profit: number;
  detail: string;
  sourceItem: ReportTransaction["items"][number];
};

type GroupedRows = {
  dateKey: string;
  dateLabel: string;
  rows: ReportRow[];
  subtotalCost: number;
  subtotalRevenue: number;
  subtotalProfit: number;
};

type PulsaRow = {
  key: string;
  dateKey: string;
  dateLabel: string;
  destinationNumber: string;
  description: string;
  modal: number;
  price: number;
  total: number;
  profit: number;
  balance: number | null;
};

type PulsaGroup = {
  dateKey: string;
  dateLabel: string;
  rows: PulsaRow[];
  subtotalModal: number;
  subtotalTotal: number;
  subtotalProfit: number;
};

const categoryEndpointMap: Record<ReportCategory, string> = {
  HANDPHONE: "/api/laporan/hp",
  PRODUK_LAIN: "/api/laporan/produk-lain",
  PULSA: "/api/laporan/pulsa",
};

const filterToCategory: Record<Exclude<ReportProductFilter, "all">, ReportCategory> = {
  phone: "HANDPHONE",
  accessory: "PRODUK_LAIN",
  voucher: "PRODUK_LAIN",
  pulsa: "PULSA",
};

const getItemType = (item: ReportTransaction["items"][number]) => {
  if (item.phone) return "phone" as const;
  if (item.accessory) return "accessory" as const;
  if (item.voucher) return "voucher" as const;
  if (item.pulsa || item.pulsaDestinationNumber) return "pulsa" as const;
  return "unknown" as const;
};

const shouldIncludeItemByFilter = (item: ReportTransaction["items"][number], filter: ReportProductFilter) => {
  if (filter === "all") return true;
  const itemType = getItemType(item);
  if (filter === "accessory") return itemType === "accessory" || itemType === "voucher";
  return itemType === filter;
};

const groupThemes = [
  {
    header: "bg-sky-100 text-sky-900",
    row: "bg-sky-50",
    subtotal: "bg-sky-200 text-sky-900",
  },
  {
    header: "bg-emerald-100 text-emerald-900",
    row: "bg-emerald-50",
    subtotal: "bg-emerald-200 text-emerald-900",
  },
  {
    header: "bg-amber-100 text-amber-900",
    row: "bg-amber-50",
    subtotal: "bg-amber-200 text-amber-900",
  },
  {
    header: "bg-rose-100 text-rose-900",
    row: "bg-rose-50",
    subtotal: "bg-rose-200 text-rose-900",
  },
];

const rupiah = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;

const toDateLabel = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy");
};

const toDateKey = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
};

const normalizeFilterLabel = (filter: ReportProductFilter) => {
  if (filter === "phone") return "Handphone";
  if (filter === "pulsa") return "Pulsa";
  if (filter === "accessory") return "Produk Lain";
  if (filter === "voucher") return "Voucher";
  return "Semua Produk";
};

const normalizeCategoryTitle = (filter: ReportProductFilter) => {
  if (filter === "phone") return "Laporan HP";
  if (filter === "pulsa") return "Laporan Pulsa";
  if (filter === "accessory") return "Laporan Produk Lain";
  if (filter === "voucher") return "Laporan Voucher";
  return "Laporan Semua Produk";
};

const getMetadataValue = (metadata: Array<{ key: string; value: string }> | undefined, patterns: RegExp[]) => {
  if (!metadata?.length) return "";
  const found = metadata.find((item) => patterns.some((pattern) => pattern.test(String(item.key || ""))));
  return found?.value || "";
};

const buildRowDetail = (item: ReportTransaction["items"][number]) => {
  if (item.phone) {
    return `IMEI: ${item.phone.imei}`;
  }
  if (item.accessory) {
    return `Kode: ${item.accessory.code}`;
  }
  if (item.voucher) {
    return `Kode: ${item.voucher.code}`;
  }
  if (item.pulsa) {
    return item.pulsa.destinationNumber || item.pulsa.description || item.pulsa.note || "-";
  }
  return "-";
};

const buildProductLabel = (item: ReportTransaction["items"][number]) => {
  if (item.phone) return `${item.phone.brand} ${item.phone.type}`;
  if (item.accessory) return item.accessory.name;
  if (item.voucher) return item.voucher.name;
  if (item.pulsa) return `${item.pulsa.denomination.toLocaleString("id-ID")} Pulsa`;
  return "-";
};

const buildCategoryLabel = (item: ReportTransaction["items"][number]) => {
  if (item.phone) return "HP";
  if (item.accessory) return "Aksesoris";
  if (item.voucher) return "Voucher";
  if (item.pulsa) return "Pulsa";
  return "-";
};

const buildGroupedRows = (transactions: ReportTransaction[], productFilter: ReportProductFilter) => {
  const map = new Map<
    string,
    {
      dateKey: string;
      dateLabel: string;
      rows: ReportRow[];
      subtotalCost: number;
      subtotalRevenue: number;
      subtotalProfit: number;
    }
  >();

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  sortedTransactions.forEach((transaction) => {
    const dateKey = toDateKey(transaction.createdAt);
    const dateLabel = toDateLabel(transaction.createdAt);
    if (!dateKey) return;

    if (!map.has(dateKey)) {
      map.set(dateKey, {
        dateKey,
        dateLabel,
        rows: [],
        subtotalCost: 0,
        subtotalRevenue: 0,
        subtotalProfit: 0,
      });
    }

    const group = map.get(dateKey)!;

    transaction.items.forEach((item, index) => {
      if (!shouldIncludeItemByFilter(item, productFilter)) return;

      const quantity = Number(item.quantity || 1);
      const baseRevenue = Number(item.sellPrice || 0) * quantity;
      const baseCost = Number(item.costPrice || 0) * quantity;
      const sign = transaction.status === "REFUND" ? -1 : 1;
      const revenue = baseRevenue * sign;
      const cost = baseCost * sign;
      const profit = (baseRevenue - baseCost) * sign;
      const product = buildProductLabel(item);
      const category = buildCategoryLabel(item);
      const detail = buildRowDetail(item);

      group.rows.push({
        key: `${transaction.id}-${index}`,
        dateKey,
        dateLabel,
        category,
        product,
        quantity,
        cost,
        revenue,
        profit,
        detail,
        sourceItem: item,
      });

      group.subtotalCost += cost;
      group.subtotalRevenue += revenue;
      group.subtotalProfit += profit;
    });
  });

  return Array.from(map.values())
    .filter((group) => group.rows.length > 0)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
};

const buildPulsaRows = (transactions: ReportTransaction[]) => {
  const rows: PulsaRow[] = [];

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  sortedTransactions.forEach((transaction) => {
    const dateKey = toDateKey(transaction.createdAt);
    const dateLabel = toDateLabel(transaction.createdAt);
    if (!dateKey) return;

    transaction.items.forEach((item, index) => {
      const isPulsaRow = Boolean(item.pulsa || item.pulsaDestinationNumber || transaction.category === "PULSA");
      if (!isPulsaRow) return;

      const quantity = Number(item.quantity || 1);
      const sign = transaction.status === "REFUND" ? -1 : 1;
      const total = Number(transaction.totalAmount ?? item.sellPrice ?? 0) * sign;
      const modal = Number(transaction.totalCost ?? item.costPrice ?? 0) * sign;
      const profit = Number(transaction.profit ?? total - modal) * sign;

      rows.push({
        key: `${transaction.id}-${index}`,
        dateKey,
        dateLabel,
        destinationNumber: item.pulsaDestinationNumber || item.pulsa?.destinationNumber || "-",
        description: item.pulsaDescription || item.pulsa?.description || item.pulsa?.note || "-",
        modal,
        price: Number(item.sellPrice ?? transaction.totalAmount ?? 0) * sign,
        total: quantity > 1 ? total * quantity : total,
        profit,
        balance: item.pulsaBalance ?? null,
      });
    });
  });

  return rows.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
};

const buildPulsaRowsForExport = (rows: PulsaRow[]) => {
  return [
    ["Tanggal Jual", "No Tujuan", "Keterangan", "Modal", "Harga Jual", "Total", "Keuntungan", "Saldo"],
    ...rows.map((row) => [
      row.dateLabel,
      row.destinationNumber,
      row.description,
      row.modal,
      row.price,
      row.total,
      row.profit,
      row.balance ?? "",
    ]),
  ];
};

const buildPulsaGroups = (rows: PulsaRow[]) => {
  const map = new Map<string, PulsaGroup>();

  rows.forEach((row) => {
    if (!map.has(row.dateKey)) {
      map.set(row.dateKey, {
        dateKey: row.dateKey,
        dateLabel: row.dateLabel,
        rows: [],
        subtotalModal: 0,
        subtotalTotal: 0,
        subtotalProfit: 0,
      });
    }

    const group = map.get(row.dateKey)!;
    group.rows.push(row);
    group.subtotalModal += row.modal;
    group.subtotalTotal += row.total;
    group.subtotalProfit += row.profit;
  });

  return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
};

const buildPhoneRowsForExport = (groupedRows: GroupedRows[]) => {
  const rows: (string | number)[][] = [
    [
      "MERK",
      "TYPE",
      "IMEI",
      "WARNA",
      "TGL_BELI",
      "BELI_DARI",
      "HARGA_BELI",
      "Ket_Serv",
      "BIAYA_SERVICE",
      "TGL_JUAL",
      "HARGA_JUAL",
      "RL",
      "",
      "HPP",
    ],
  ];

  groupedRows.forEach((group) => {
    rows.push([`TGL JUAL: ${group.dateLabel}`, "", "", "", "", "", "", "", "", "", "", "", "", ""]);

    group.rows.forEach((row) => {
      const phone = row.sourceItem.phone;
      if (!phone) return;

      const hargaBeli = Number(phone.purchasePrice || row.cost || 0);
      const biayaService = 0;
      const hargaJual = Number(row.revenue || 0);
      const hpp = hargaBeli + biayaService;
      const rl = hargaJual - hpp;
      const beliDari = getMetadataValue(phone.metadata, [/beli\s*dari/i, /supplier/i, /asal/i]);
      const ketServ = getMetadataValue(phone.metadata, [/ket\s*serv/i, /service/i, /catatan/i]);

      rows.push([
        phone.brand || "",
        phone.type || "",
        phone.imei || "",
        phone.color || "",
        toDateLabel(phone.purchaseDate),
        beliDari,
        hargaBeli,
        ketServ,
        biayaService,
        group.dateLabel,
        hargaJual,
        rl,
        "",
        hpp,
      ]);
    });

    rows.push([
      `Subtotal ${group.dateLabel}`,
      "",
      "",
      "",
      "",
      "",
      group.subtotalCost,
      "",
      "",
      "",
      group.subtotalRevenue,
      group.subtotalProfit,
      "",
      group.subtotalCost,
    ]);
  });

  return rows;
};

const applyBestEffortFill = (worksheet: XLSX.WorkSheet, rowIndex: number, colCount: number, color: string) => {
  for (let col = 0; col < colCount; col += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: col });
    const cell = worksheet[cellAddress];
    if (!cell) continue;
    cell.s = {
      ...(cell.s || {}),
      fill: {
        fgColor: { rgb: color },
      },
      font: {
        ...(cell.s?.font || {}),
        bold: rowIndex === 0,
      },
    };
  }
};

async function fetchCategoryReport(startDate: string, endDate: string, categories: ReportCategory[]) {
  const responses = await Promise.all(
    categories.map(async (category) => {
      const url = new URL(categoryEndpointMap[category], window.location.origin);
      url.searchParams.set("startDate", startDate);
      url.searchParams.set("endDate", endDate);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `Gagal mengambil laporan ${category}`);
      }

      return res.json();
    })
  );

  return responses.reduce(
    (acc, report) => {
      const transactions = [...acc.transactions, ...(report.transactions || [])];
      const summary = {
        totalRevenue: acc.summary.totalRevenue + (report.summary?.totalRevenue || 0),
        totalCost: acc.summary.totalCost + (report.summary?.totalCost || 0),
        totalProfit: acc.summary.totalProfit + (report.summary?.totalProfit || 0),
        transactionCount: acc.summary.transactionCount + (report.summary?.transactionCount || 0),
      };

      return { transactions, summary };
    },
    {
      transactions: [] as ReportTransaction[],
      summary: {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        transactionCount: 0,
      },
    }
  );
}

const getLocalDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
};

const filterTransactionsByDateRange = (
  transactions: ReportTransaction[],
  startDate: string,
  endDate: string
) => {
  return transactions.filter((transaction) => {
    const dateKey = getLocalDateKey(transaction.createdAt);
    return Boolean(dateKey) && dateKey >= startDate && dateKey <= endDate;
  });
};

const summarizeTransactions = (transactions: ReportTransaction[]) => {
  return transactions.reduce(
    (acc, transaction) => {
      const sign = transaction.status === "REFUND" ? -1 : 1;
      acc.totalRevenue += Number(transaction.totalAmount || 0) * sign;
      acc.totalCost += Number(transaction.totalCost || 0) * sign;
      acc.totalProfit += Number(transaction.profit || 0) * sign;
      acc.transactionCount += 1;
      return acc;
    },
    {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      transactionCount: 0,
    }
  );
};

export default function LaporanKeuanganPage() {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<ReportTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [productFilter, setProductFilter] = useState<ReportProductFilter>("all");
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [monthlyCost, setMonthlyCost] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [pulsaRows, setPulsaRows] = useState<PulsaRow[]>([]);
  const inFlightKeyRef = useRef<string | null>(null);
  const [updatingStatusTxId, setUpdatingStatusTxId] = useState<string | null>(null);

  const fixedFilter: ReportProductFilter | null =
    pathname === "/laporan/hp"
      ? "phone"
      : pathname === "/laporan/produk-lain"
        ? "accessory"
        : pathname === "/laporan/pulsa"
          ? "pulsa"
          : null;

  const effectiveFilter = fixedFilter ?? productFilter;

  useEffect(() => {
    if (fixedFilter) {
      setProductFilter(fixedFilter);
      return;
    }

    const category = searchParams.get("category");
    if (category === "HANDPHONE") setProductFilter("phone");
    if (category === "PRODUK_LAIN") setProductFilter("accessory");
    if (category === "PULSA") setProductFilter("pulsa");
  }, [fixedFilter, searchParams]);

  const fetchLaporan = useCallback(async () => {
    const requestKey = `${effectiveFilter}|${startDate}|${endDate}`;
    if (inFlightKeyRef.current === requestKey) return;
    inFlightKeyRef.current = requestKey;

    setLoading(true);
    try {
      const categories: ReportCategory[] =
        effectiveFilter === "all"
          ? ["HANDPHONE", "PRODUK_LAIN", "PULSA"]
          : [filterToCategory[effectiveFilter]];

      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");
      const requestStart = [startDate, monthStart, today].sort()[0];
      const requestEnd = [endDate, today].sort()[1];

      const report = await fetchCategoryReport(requestStart, requestEnd, categories);
      const allTransactions = report.transactions || [];
      const tableTransactions = filterTransactionsByDateRange(allTransactions, startDate, endDate);
      const monthTransactions = filterTransactionsByDateRange(allTransactions, monthStart, today);
      const todayTransactions = filterTransactionsByDateRange(allTransactions, today, today);
      const monthSummary = summarizeTransactions(monthTransactions);
      const todaySummary = summarizeTransactions(todayTransactions);

      setTransactions(tableTransactions);
      setPulsaRows(buildPulsaRows(tableTransactions));
      setMonthlyProfit(monthSummary.totalProfit);
      setMonthlyCost(monthSummary.totalCost);
      setTodayProfit(todaySummary.totalProfit);
    } catch (error) {
      console.error("Gagal mengambil laporan:", error);
    } finally {
      if (inFlightKeyRef.current === requestKey) {
        inFlightKeyRef.current = null;
      }
      setLoading(false);
    }
  }, [effectiveFilter, endDate, startDate]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      void fetchLaporan();
    }
  }, [fetchLaporan, router, status]);

  const exportToExcel = () => {
    const groupedRows = buildGroupedRows(transactions, effectiveFilter);

    if (effectiveFilter === "phone") {
      const aoa = buildPhoneRowsForExport(groupedRows);
      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      worksheet["!cols"] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 6 },
        { wch: 14 },
      ];

      let rowIndex = 1;
      groupedRows.forEach((group, index) => {
        applyBestEffortFill(worksheet, rowIndex, 14, index % 2 === 0 ? "E0F2FE" : "F0FDF4");
        rowIndex += 1;
        group.rows.forEach(() => {
          applyBestEffortFill(worksheet, rowIndex, 14, index % 2 === 0 ? "F8FBFF" : "F7FFF8");
          rowIndex += 1;
        });
        applyBestEffortFill(worksheet, rowIndex, 14, index % 2 === 0 ? "BAE6FD" : "BBF7D0");
        rowIndex += 1;
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, worksheet, "Laporan HP");
      XLSX.writeFile(wb, `Laporan_HP_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      return;
    }

    if (effectiveFilter === "pulsa") {
      const aoa = buildPulsaRowsForExport(pulsaRows);
      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      worksheet["!cols"] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, worksheet, "Laporan Pulsa");
      XLSX.writeFile(wb, `Laporan_Pulsa_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      return;
    }

    const aoa: (string | number)[][] = [["Tanggal Jual", "Kategori", "Item", "Qty", "Modal", "Jual", "Laba/Rugi"]];
    groupedRows.forEach((group) => {
      aoa.push([`TGL JUAL: ${group.dateLabel}`, "", "", "", "", "", ""]);
      group.rows.forEach((row) => {
        aoa.push([group.dateLabel, row.category, row.product, row.quantity, row.cost, row.revenue, row.profit]);
      });
      aoa.push([`Subtotal ${group.dateLabel}`, "", "", "", group.subtotalCost, group.subtotalRevenue, group.subtotalProfit]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 28 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    let cursor = 1;
    groupedRows.forEach((group, index) => {
      applyBestEffortFill(worksheet, cursor, 7, index % 2 === 0 ? "E0F2FE" : "F0FDF4");
      cursor += 1;
      group.rows.forEach(() => {
        applyBestEffortFill(worksheet, cursor, 7, index % 2 === 0 ? "F8FBFF" : "F7FFF8");
        cursor += 1;
      });
      applyBestEffortFill(worksheet, cursor, 7, index % 2 === 0 ? "BAE6FD" : "BBF7D0");
      cursor += 1;
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, "Laporan");
    XLSX.writeFile(wb, `Laporan_${normalizeFilterLabel(effectiveFilter).replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const groupedRows = buildGroupedRows(transactions, effectiveFilter);
  const groupedPulsaRows = buildPulsaGroups(pulsaRows);
  const totalItems = groupedRows.reduce((sum, group) => sum + group.rows.length, 0);
  const statusByTransactionId = new Map(transactions.map((transaction) => [transaction.id, transaction.status]));

  const updateTransactionStatus = async (transactionId: string, status: "PAID" | "REFUND") => {
    try {
      setUpdatingStatusTxId(transactionId);
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Gagal update status transaksi");
      }

      await fetchLaporan();
    } catch (error) {
      console.error("Gagal update status transaksi:", error);
      alert(error instanceof Error ? error.message : "Gagal update status transaksi");
    } finally {
      setUpdatingStatusTxId(null);
    }
  };

  return (
    <div className="relative mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top_right,_rgba(139,92,246,0.18),_transparent_45%),radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_35%)]" />

      <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-col gap-6 border-b border-slate-200/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
              Taurus Cellular
            </div>
            <div>
              <h1 className="text-3xl font-semibold sm:text-4xl">Laporan Keuangan</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
                Tabel transaksi, ringkasan bulanan, dan laba hari ini dalam tampilan dashboard kasir yang lebih modern.
              </p>
            </div>
          </div>
          <button
            onClick={exportToExcel}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-50"
          >
            Export ke Spreadsheet
          </button>
        </div>

        <div className="grid gap-4 border-b border-slate-200/70 bg-slate-50/80 px-6 py-6 sm:grid-cols-3 sm:px-8">
          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">Laba Bulan Ini</p>
            <p className={`mt-4 text-3xl font-semibold ${monthlyProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {rupiah(monthlyProfit)}
            </p>
          </div>
          <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Modal Bulan Ini</p>
            <p className="mt-4 text-3xl font-semibold text-amber-600">
              {rupiah(monthlyCost)}
            </p>
          </div>
          <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">Keuntungan Hari Ini</p>
            <p className={`mt-4 text-3xl font-semibold ${todayProfit >= 0 ? "text-sky-600" : "text-rose-600"}`}>
              {rupiah(todayProfit)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus:border-transparent focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus:border-transparent focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 border-b border-slate-200/70 bg-slate-50/80 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Detail Transaksi</h2>
            <p className="mt-1 text-sm text-slate-500">
              {normalizeCategoryTitle(effectiveFilter)} • {effectiveFilter === "pulsa" ? pulsaRows.length : totalItems} baris item
            </p>
          </div>
          <span className="text-sm font-medium text-slate-500">
            {groupedRows.length} kelompok tanggal
          </span>
        </div>

        {loading ? (
          <div className="px-8 py-12 text-center text-slate-500">Memuat laporan...</div>
        ) : groupedRows.length === 0 ? (
          <div className="px-8 py-12 text-center text-slate-500">Belum ada data pada periode ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50">
                {effectiveFilter === "pulsa" ? (
                    <>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Tanggal Jual</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">No Tujuan</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Keterangan</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-600">Modal</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-600">Harga Jual</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-600">Total</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-600">Keuntungan</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Status</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 uppercase tracking-wide">Item</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 uppercase tracking-wide">Kategori</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 uppercase tracking-wide">Detail</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wide">Qty</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wide">Modal</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wide">Jual</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600 uppercase tracking-wide">Laba/Rugi</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {effectiveFilter === "pulsa"
                  ? groupedPulsaRows.map((group, index) => {
                      const theme = groupThemes[index % groupThemes.length];
                      return (
                        <Fragment key={group.dateKey}>
                          <tr className={theme.header}>
                            <td colSpan={8} className="px-6 py-3 text-sm font-semibold">
                              Tgl Jual: {group.dateLabel} • {group.rows.length} item • {rupiah(group.subtotalProfit)}
                            </td>
                          </tr>
                          {group.rows.map((row) => (
                            <tr key={row.key} className={`${theme.row} transition hover:bg-white/80`}>
                              <td className="px-6 py-4 text-sm text-slate-700">{row.dateLabel}</td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-slate-900">{row.destinationNumber}</div>
                                <div className="text-xs text-slate-500">Saldo: {row.balance ?? "-"}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">{row.description}</td>
                              <td className="px-6 py-4 text-right text-sm text-amber-700">{rupiah(row.modal)}</td>
                              <td className="px-6 py-4 text-right text-sm text-emerald-700">{rupiah(row.price)}</td>
                              <td className="px-6 py-4 text-right text-sm text-slate-700">{rupiah(row.total)}</td>
                              <td className={`px-6 py-4 text-right text-sm font-semibold ${row.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                {rupiah(row.profit)}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                <select
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                  value={statusByTransactionId.get(row.key.split("-")[0]) || "REFUND"}
                                  onChange={(e) =>
                                    updateTransactionStatus(row.key.split("-")[0], e.target.value as "PAID" | "REFUND")
                                  }
                                  disabled={updatingStatusTxId === row.key.split("-")[0]}
                                >
                                  <option value="PAID">PAID</option>
                                  <option value="REFUND">REFUND</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                          <tr className={theme.subtotal}>
                            <td className="px-6 py-4 font-semibold">Subtotal {group.dateLabel}</td>
                            <td className="px-6 py-4 text-sm" colSpan={2}>
                              Laba/Rugi kelompok tanggal ini
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-semibold">{rupiah(group.subtotalModal)}</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold">-</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold">{rupiah(group.subtotalTotal)}</td>
                            <td className={`px-6 py-4 text-right text-sm font-semibold ${group.subtotalProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                              {rupiah(group.subtotalProfit)}
                            </td>
                            <td />
                          </tr>
                        </Fragment>
                      );
                    })
                  : groupedRows.map((group, index) => {
                      const theme = groupThemes[index % groupThemes.length];
                      return (
                        <Fragment key={group.dateKey}>
                          <tr className={theme.header}>
                            <td colSpan={8} className="px-6 py-3 text-sm font-semibold">
                              Tgl Jual: {group.dateLabel} • {group.rows.length} item • {rupiah(group.subtotalProfit)}
                            </td>
                          </tr>
                          {group.rows.map((row) => (
                            <tr key={row.key} className={`${theme.row} transition hover:bg-white/80`}>
                              <td className="px-6 py-4">
                                <div className="font-medium text-slate-900">{row.product}</div>
                                <div className="text-xs text-slate-500">{row.dateLabel}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">{row.category}</td>
                              <td className="px-6 py-4 text-sm text-slate-700">{row.detail}</td>
                              <td className="px-6 py-4 text-right text-sm text-slate-700">{row.quantity}</td>
                              <td className="px-6 py-4 text-right text-sm text-amber-700">{rupiah(row.cost)}</td>
                              <td className="px-6 py-4 text-right text-sm text-emerald-700">{rupiah(row.revenue)}</td>
                              <td className={`px-6 py-4 text-right text-sm font-semibold ${row.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                {rupiah(row.profit)}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                <select
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                  value={statusByTransactionId.get(row.key.split("-")[0]) || "REFUND"}
                                  onChange={(e) =>
                                    updateTransactionStatus(row.key.split("-")[0], e.target.value as "PAID" | "REFUND")
                                  }
                                  disabled={updatingStatusTxId === row.key.split("-")[0]}
                                >
                                  <option value="PAID">PAID</option>
                                  <option value="REFUND">REFUND</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                          <tr className={theme.subtotal}>
                            <td className="px-6 py-4 font-semibold">Subtotal {group.dateLabel}</td>
                            <td className="px-6 py-4 text-sm" colSpan={2}>
                              Laba/Rugi kelompok tanggal ini
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-semibold">
                              {group.rows.reduce((sum, row) => sum + row.quantity, 0)}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-semibold">{rupiah(group.subtotalCost)}</td>
                            <td className="px-6 py-4 text-right text-sm font-semibold">{rupiah(group.subtotalRevenue)}</td>
                            <td className={`px-6 py-4 text-right text-sm font-semibold ${group.subtotalProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                              {rupiah(group.subtotalProfit)}
                            </td>
                            <td />
                          </tr>
                        </Fragment>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
