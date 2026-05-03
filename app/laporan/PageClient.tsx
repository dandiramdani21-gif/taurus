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
  servedByName?: string | null;
  totalAmount: number;
  totalCost: number;
  profit: number;
  note?: string | null;
  debt_note: string;
  items: Array<{
    id: string;
    status: "PAID" | "REFUND";  // ← TAMBAHKAN ini
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
  itemId: string;  // ← TAMBAHKAN
  transactionId: string;
  debt_note: string
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
  itemId: string;  // ← TAMBAHKAN
  status: "PAID" | "REFUND";  // ← TAMBAHKAN INI
  transactionId: string;
  dateKey: string;
  dateLabel: string;
  destinationNumber: string;
  debt_note: string;
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
      const multiplier = item.status === "REFUND" ? 0 : 1;
      const revenue = baseRevenue * multiplier;
      const cost = baseCost * multiplier;
      const profit = (baseRevenue - baseCost) * multiplier;
      const product = buildProductLabel(item);
      const category = buildCategoryLabel(item);
      const detail = buildRowDetail(item);
      const debt_note = transaction.debt_note

      group.rows.push({
        key: `${transaction.id}`,
        transactionId: transaction.id,
        itemId: item.id,
        dateKey,
        debt_note,
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
      const multiplier = item.status === "REFUND" ? 0 : 1;
      const total = Number(transaction.totalAmount ?? item.sellPrice ?? 0) * multiplier;
      const modal = Number(transaction.totalCost ?? item.costPrice ?? 0) * multiplier;
      const profit = Number(transaction.profit ?? total - modal) * multiplier;

      rows.push({
        key: `${transaction.id}-${index}`,
        status: item.status,
        itemId: item.id,
        transactionId: transaction.id,
        dateKey,
        dateLabel,
        destinationNumber: item.pulsaDestinationNumber || item.pulsa?.destinationNumber || "-",
        debt_note: transaction.debt_note,
        description: item.pulsaDescription || item.pulsa?.description || item.pulsa?.note || "-",
        modal,
        price: Number(item.sellPrice ?? transaction.totalAmount ?? 0) * multiplier,
        total: quantity > 1 ? total * quantity : total,
        profit,
        balance: item.pulsaBalance ?? null,
      });
    });
  });

  return rows.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
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

async function fetchCategoryReport(startDate: string, endDate: string, categories: ReportCategory[], search: string) {
  const responses = await Promise.all(
    categories.map(async (category) => {
      const url = new URL(categoryEndpointMap[category], window.location.origin);
      url.searchParams.set("startDate", startDate);
      url.searchParams.set("endDate", endDate);
      url.searchParams.set("search", search);

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
      transaction.items.forEach((item) => {
        if (item.status === "PAID") {
          const revenue = Number(item.sellPrice || 0) * Number(item.quantity || 1);
          const cost = Number(item.costPrice || 0) * Number(item.quantity || 1);
          acc.totalRevenue += revenue;
          acc.totalCost += cost;
          acc.totalProfit += revenue - cost;
          acc.transactionCount += 1; // Hitung per item, bukan per transaksi
        }
      });
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
  const [debtNotes, setDebtNotes] = useState<Record<string, string>>({});
  const [pulsaRows, setPulsaRows] = useState<PulsaRow[]>([]);
  const inFlightKeyRef = useRef<string | null>(null);
  const [updatingStatusTxId, setUpdatingStatusTxId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = Number.MAX_SAFE_INTEGER;
  const [search, setSearch] = useState("");

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
  }, [fixedFilter, searchParams, search]);

  useEffect(() => {
    setPage(1);
  }, [effectiveFilter, startDate, endDate, search]);


  async function fetchAllDataForExport(
    startDate: string,
    endDate: string,
    categories: ReportCategory[],
    search: string
  ) {
    const responses = await Promise.all(
      categories.map(async (category) => {
        const url = new URL(categoryEndpointMap[category], window.location.origin);
        url.searchParams.set("startDate", startDate);
        url.searchParams.set("endDate", endDate);
        url.searchParams.set("search", search);
        url.searchParams.set("page", "1");
        url.searchParams.set("pageSize", "1000"); // Limit 1000 items

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




  // Handle key down - detect Enter
  const handleDebtNoteKeyDown = (transactionId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent form submission if any
      const currentValue = (e.target as HTMLInputElement).value;
      // Trigger blur manually
      handleDebtNoteBlur(transactionId, currentValue);
    }
  };

  const handleDebtNoteBlur = async (transactionId: string, value: string) => {
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debt_note: value }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Gagal update catatan piutang");
      }

      // Optional: refresh laporan atau update local state
      await fetchLaporan();
    } catch (error) {
      console.error("Gagal update catatan piutang:", error);
      alert(error instanceof Error ? error.message : "Gagal update catatan piutang");
    }
  };

  // Handle change untuk input tertentu
  const handleDebtNoteChange = (transactionId: string, value: string) => {
    setDebtNotes(prev => ({ ...prev, [transactionId]: value }));
  };

  const fetchLaporan = useCallback(async () => {
    const requestKey = `${effectiveFilter}|${startDate}|${endDate}|${page}`;
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

      const report = await fetchCategoryReport(requestStart, requestEnd, categories, search);
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
  }, [effectiveFilter, endDate, startDate, search, page]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      void fetchLaporan();
    }
  }, [fetchLaporan, router, status]);

  // Update fungsi exportToExcel
  const exportToExcel = async () => {
    try {
      setLoading(true);

      const categories: ReportCategory[] =
        effectiveFilter === "all"
          ? ["HANDPHONE", "PRODUK_LAIN", "PULSA"]
          : [filterToCategory[effectiveFilter]];

      const { transactions: exportTransactions } = await fetchAllDataForExport(
        startDate,
        endDate,
        categories,
        search
      );

      const filteredTransactions = filterTransactionsByDateRange(
        exportTransactions,
        startDate,
        endDate
      );

      if (filteredTransactions.length === 0) {
        alert("Tidak ada data untuk diexport pada periode ini.");
        setLoading(false);
        return;
      }

      const groupedRows = buildGroupedRows(filteredTransactions, effectiveFilter);
      const pulsaRowsData = buildPulsaRows(filteredTransactions);
      const groupedPulsaRows = buildPulsaGroups(pulsaRowsData);

      let aoa: (string | number)[][];
      let sheetName: string;
      let colWidths: { wch: number }[];

      // HP
      if (effectiveFilter === "phone") {
        aoa = buildPhoneRowsForExport(groupedRows);
        sheetName = "Laporan HP";
        colWidths = [
          { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
          { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
          { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
          { wch: 6 }, { wch: 14 }
        ];
      }
      // Pulsa
      else if (effectiveFilter === "pulsa") {
        aoa = [
          ["No Tujuan", "Keterangan", "Denom", "TGL JUAL", "HARGA BELI", "BIAYA", "HARGA JUAL", "RL", "HPP"],
        ];

        groupedPulsaRows.forEach((group) => {
          aoa.push([`TGL JUAL: ${group.dateLabel}`, "", "", "", "", "", "", "", "", ""]);

          group.rows.forEach((row) => {
            const hargaBeli = Number(row.modal || 0);
            const biaya = 0;
            const hargaJual = Number(row.price || 0);
            const hpp = hargaBeli + biaya;
            const rl = hargaJual - hpp;
            const denomination = row.description.match(/\d+/)?.[0] || "-";

            aoa.push([
              row.destinationNumber,
              row.description,
              denomination,
              row.dateLabel,
              hargaBeli,
              biaya,
              hargaJual,
              rl,
              hpp
            ]);
          });

          aoa.push([
            `Subtotal ${group.dateLabel}`,
            "",
            "",
            "",
            group.subtotalModal,
            "",
            group.subtotalTotal,
            group.subtotalProfit,
            group.subtotalModal,
            "",
          ]);
        });

        sheetName = "Laporan Pulsa";
        colWidths = [
          { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 14 },
          { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
          { wch: 14 }
        ];
      }
      // PRODUK_LAIN (accessory, voucher, all)
      else {
        aoa = [
          ["NAMA PRODUK", "KODE", "TGL BELI", "HARGA BELI", "BIAYA SERVICE", "TGL JUAL", "HARGA JUAL", "RL", "HPP"],
        ];

        groupedRows.forEach((group) => {
          aoa.push([`TGL JUAL: ${group.dateLabel}`, "", "", "", "", "", "", "", ""]);

          group.rows.forEach((row) => {
            const accessory = row.sourceItem.accessory;
            const voucher = row.sourceItem.voucher;

            const hargaBeli = Number(row.cost || 0);
            const biayaService = 0;
            const hargaJual = Number(row.revenue || 0);
            const hpp = hargaBeli + biayaService;
            const rl = hargaJual - hpp;

            let namaProduk = "";
            let kode = "";
            const tglBeli = "-";

            if (accessory) {
              namaProduk = accessory.name;
              kode = accessory.code;
            } else if (voucher) {
              namaProduk = voucher.name;
              kode = voucher.code;
            }

            aoa.push([
              namaProduk,
              kode,
              tglBeli,
              hargaBeli,
              biayaService,
              group.dateLabel,
              hargaJual,
              rl,
              hpp,
            ]);
          });

          aoa.push([
            `Subtotal ${group.dateLabel}`,
            "",
            "",
            group.subtotalCost,
            "",
            "",
            group.subtotalRevenue,
            group.subtotalProfit,
            group.subtotalCost,
          ]);
        });

        sheetName = effectiveFilter === "accessory" ? "Laporan Produk Lain"
          : effectiveFilter === "voucher" ? "Laporan Voucher"
            : "Laporan Semua Produk";
        colWidths = [
          { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
          { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
          { wch: 14 }
        ];
      }

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      worksheet["!cols"] = colWidths;

      // Apply styling
      let rowIndex = 0;
      const groupsToStyle = effectiveFilter === "pulsa" ? groupedPulsaRows : groupedRows;
      const colCount = colWidths.length;

      groupsToStyle.forEach((_, index) => {
        rowIndex += 1; // skip header or date row
        const rowsInGroup = effectiveFilter === "pulsa"
          ? (groupsToStyle as PulsaGroup[])[index].rows.length
          : (groupsToStyle as GroupedRows[])[index].rows.length;

        for (let i = 0; i < rowsInGroup; i++) {
          applyBestEffortFill(worksheet, rowIndex, colCount, index % 2 === 0 ? "F8FBFF" : "F7FFF8");
          rowIndex += 1;
        }
        applyBestEffortFill(worksheet, rowIndex, colCount, index % 2 === 0 ? "BAE6FD" : "BBF7D0");
        rowIndex += 1;
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, worksheet, sheetName);
      XLSX.writeFile(wb, `${sheetName}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    } catch (error) {
      console.error("Gagal export ke Excel:", error);
      alert(error instanceof Error ? error.message : "Gagal export ke Excel");
    } finally {
      setLoading(false);
    }
  };


  const groupedRows = buildGroupedRows(transactions, effectiveFilter);
  const groupedPulsaRows = buildPulsaGroups(pulsaRows);
  const totalItems = groupedRows.reduce((sum, group) => sum + group.rows.length, 0);
  const totalPulsaItems = groupedPulsaRows.reduce((sum, group) => sum + group.rows.length, 0);

  // Calculate pagination based on items (not groups)
  const currentTotalItems = effectiveFilter === "pulsa" ? totalPulsaItems : totalItems;
  const totalPages = Math.max(1, Math.ceil(currentTotalItems / itemsPerPage));
  const itemStartIndex = (page - 1) * itemsPerPage;
  const itemEndIndex = itemStartIndex + itemsPerPage;

  // Paginate and reconstruct groups for non-pulsa
  let pagedGroups: typeof groupedRows = [];
  let pagedPulsaGroups: typeof groupedPulsaRows = [];

  if (effectiveFilter === "pulsa") {
    // For pulsa: flatten, slice, and reconstruct
    const flatItems = groupedPulsaRows.flatMap((group) =>
      group.rows.map((row) => ({ ...row, groupInfo: group }))
    );
    const slicedItems = flatItems.slice(itemStartIndex, itemEndIndex);

    const groupMap = new Map<string, (typeof groupedPulsaRows)[0]>();
    slicedItems.forEach((item) => {
      const key = item.groupInfo.dateKey;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          dateKey: item.groupInfo.dateKey,
          dateLabel: item.groupInfo.dateLabel,
          rows: [],
          subtotalModal: 0,
          subtotalTotal: 0,
          subtotalProfit: 0,
        });
      }
      const group = groupMap.get(key)!;
      group.rows.push(item);
      group.subtotalModal += item.modal;
      group.subtotalTotal += item.total;
      group.subtotalProfit += item.profit;
    });
    pagedPulsaGroups = Array.from(groupMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  } else {
    // For non-pulsa: flatten, slice, and reconstruct
    const flatItems = groupedRows.flatMap((group) =>
      group.rows.map((row) => ({ ...row, groupInfo: group }))
    );
    const slicedItems = flatItems.slice(itemStartIndex, itemEndIndex);

    const groupMap = new Map<string, (typeof groupedRows)[0]>();
    slicedItems.forEach((item) => {
      const key = item.groupInfo.dateKey;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          dateKey: item.groupInfo.dateKey,
          dateLabel: item.groupInfo.dateLabel,
          rows: [],
          subtotalCost: 0,
          subtotalRevenue: 0,
          subtotalProfit: 0,
        });
      }
      const group = groupMap.get(key)!;
      group.rows.push(item);
      group.subtotalCost += item.cost;
      group.subtotalRevenue += item.revenue;
      group.subtotalProfit += item.profit;
    });
    pagedGroups = Array.from(groupMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }


  const updateTransactionStatus = async (itemId: string, status: "PAID" | "REFUND") => {
    try {
      setUpdatingStatusTxId(itemId);
      const res = await fetch(`/api/transactions/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Gagal update status transaksi");
      }

      await fetchLaporan();
      setPage(1);
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
                Laporan transaksi pembeli
              </p>
            </div>
          </div>

        </div>

        <div className="grid gap-4 border-b border-slate-200 bg-white px-6 py-6 sm:grid-cols-3 sm:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Laba Bulan Ini
            </p>

            <p
              className={`mt-4 text-3xl font-semibold ${monthlyProfit >= 0 ? "text-slate-900" : "text-slate-500"
                }`}
            >
              {rupiah(monthlyProfit)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Modal Bulan Ini
            </p>

            <p className="mt-4 text-3xl font-semibold text-slate-900">
              {rupiah(monthlyCost)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Keuntungan Hari Ini
            </p>

            <p
              className={`mt-4 text-3xl font-semibold ${todayProfit >= 0 ? "text-slate-900" : "text-slate-500"
                }`}
            >
              {rupiah(todayProfit)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">Pencarian</label>
            <input
              type="text"
              placeholder="Cari nomor invoice atau imei..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
            />
          </div>
          <div>
            <button
              onClick={exportToExcel}
              className="bg-black inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5"
            >
              Export ke Spreadsheet
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 border-b border-slate-200/70 bg-slate-50/80 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Detail Transaksi</h2>
            <p className="mt-1 text-sm text-slate-500">
              {(() => {
                const displayedItems = effectiveFilter === "pulsa"
                  ? pagedPulsaGroups.reduce((sum, g) => sum + g.rows.length, 0)
                  : pagedGroups.reduce((sum, g) => sum + g.rows.length, 0);
                return `${normalizeCategoryTitle(effectiveFilter)} • ${displayedItems} dari ${currentTotalItems} baris item`;
              })()}
            </p>
          </div>
          <span className="text-sm font-medium text-slate-500">
            {(effectiveFilter === "pulsa" ? pagedPulsaGroups : pagedGroups).length} kelompok tanggal
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
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">Catatan</th>
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
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600 uppercase tracking-wide">Catatan</th>
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
                  ? pagedPulsaGroups.map((group, index) => {
                    const theme = groupThemes[index % groupThemes.length];
                    return (
                      <Fragment key={group.dateKey}>
                        <tr className={theme.header}>
                          <td colSpan={8} className="px-6 py-3 text-sm font-semibold">
                            Tgl Jual: {group.dateLabel} • {group.rows.length} item • {rupiah(group.subtotalProfit)}
                          </td>
                        </tr>
                        {group.rows.map((row) => (
                          <tr key={row.itemId} className={`${theme.row} transition hover:bg-white/80`}>
                            <td className="px-6 py-4 text-sm text-slate-700">{row.dateLabel}</td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900">{row.destinationNumber}</div>
                              <div className="text-xs text-slate-500">Saldo: {row.balance ?? "-"}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              <input
                                value={debtNotes[row.transactionId] || ""}
                                onChange={(e) => handleDebtNoteChange(row.transactionId, e.target.value)}
                                onBlur={(e) => handleDebtNoteBlur(row.transactionId, e.target.value)}
                                onKeyDown={(e) => handleDebtNoteKeyDown(row.transactionId, e)}
                                placeholder="Catatan"
                                className="bg-blue-100 rounded-md p-2 "
                              />
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
                                value={row.status}
                                onChange={(e) =>
                                  updateTransactionStatus(row.itemId, e.target.value as "PAID" | "REFUND")
                                }
                                disabled={updatingStatusTxId === row.itemId}
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
                          <td></td>
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
                  : pagedGroups.map((group, index) => {
                    const theme = groupThemes[index % groupThemes.length];
                    return (
                      <Fragment key={group.dateKey}>
                        <tr className={theme.header}>
                          <td colSpan={8} className="px-6 py-3 text-sm font-semibold">
                            Tgl Jual: {group.dateLabel} • {group.rows.length} item • {rupiah(group.subtotalProfit)}
                          </td>
                        </tr>
                        {group.rows.map((row) => (
                          <tr key={row.itemId} className={`${theme.row} transition hover:bg-white/80`}>
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900">{row.product}</div>
                              <div className="text-xs text-slate-500">{row.dateLabel}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">
                              <input
                                value={debtNotes[row.transactionId] || ""}
                                onChange={(e) => handleDebtNoteChange(row.transactionId, e.target.value)}
                                onBlur={(e) => handleDebtNoteBlur(row.transactionId, e.target.value)}
                                onKeyDown={(e) => handleDebtNoteKeyDown(row.transactionId, e)}
                                placeholder="Catatan"
                                className="bg-blue-100 rounded-md p-2 "
                              />
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
                                value={row.sourceItem.status}
                                onChange={(e) =>
                                  updateTransactionStatus(row.itemId, e.target.value as "PAID" | "REFUND")
                                }
                                disabled={updatingStatusTxId === row.itemId}
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
                          <td></td>
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
