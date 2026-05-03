"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

type InvoiceCategory = "ALL" | "HANDPHONE" | "PRODUK_LAIN" | "PULSA";

interface Transaction {
  id: string;
  invoiceNumber?: string | null;
  createdAt: string;
  totalAmount: number;
  totalCost: number;
  profit: number;
  status: "PAID" | "REFUND";
  servedByName?: string | null;
  category: "HANDPHONE" | "PRODUK_LAIN" | "PULSA";
  note?: string | null;
  items?: Array<{
    phone?: { brand: string; type: string; imei: string } | null;
    accessory?: { name: string; code: string } | null;
    voucher?: { name: string; code: string } | null;
    pulsa?: { denomination: number; code: string } | null;
  }>;
}

const categoryOptions: Array<{ value: InvoiceCategory; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "HANDPHONE", label: "Handphone" },
  { value: "PRODUK_LAIN", label: "Produk Lain" },
  { value: "PULSA", label: "Pulsa" },
];

const categoryLabelMap: Record<Exclude<InvoiceCategory, "ALL">, string> = {
  HANDPHONE: "Handphone",
  PRODUK_LAIN: "Produk Lain",
  PULSA: "Pulsa",
};

export default function InvoicesPage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [category, setCategory] = useState<InvoiceCategory>(() => {
    const initialCategory = searchParams.get("category") as InvoiceCategory | null;
    return initialCategory && categoryOptions.some((option) => option.value === initialCategory)
      ? initialCategory
      : "ALL";
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          search,
          type: "SALE",
        });

        if (category !== "ALL") {
          params.set("category", category);
        }
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        params.set("deleted", showDeleted ? "true" : "false");

        const res = await fetch(`/api/transactions?${params.toString()}`);
        const data = await res.json();

        setTransactions(data.transactions || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalItems(data.pagination?.total || 0);
      } catch (error) {
        console.error("Gagal mengambil invoice:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [status, page, limit, search, category, startDate, endDate, showDeleted]);

  const updateDeletedState = async (id: string, deleted: boolean) => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Gagal mengubah arsip transaksi");
      return;
    }
    setTransactions((prev) => prev.filter((transaction) => transaction.id !== id));
  };

  const handleDownload = (id: string) => {
    window.open(`/invoice/${id}?print=1`, "_blank", "noopener,noreferrer");
  };

  const handleDownloadZip = () => {
    const params = new URLSearchParams({
      search,
      type: "SALE",
      deleted: showDeleted ? "true" : "false",
    });
    if (category !== "ALL") params.set("category", category);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    window.open(`/api/transactions/export-zip?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex flex-col gap-5 px-6 py-8 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-10">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              Invoice Center
            </div>
            <h2 className="text-3xl font-semibold sm:text-4xl">Daftar Invoice</h2>
            <p className="max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              Daftar invoice yang telah berhasil melakukan pembayaran.
            </p>
          </div>

          <input
            type="text"
            placeholder="Cari: invoice, IMEI, brand, HP, nama produk, kode, no pulsa..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full lg:w-96 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/45 outline-none backdrop-blur-xl focus:border-white/20 focus:ring-2 focus:ring-white/20"
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm text-slate-700"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm text-slate-700"
        />
        <button
          type="button"
          onClick={() => {
            setShowDeleted((current) => !current);
            setPage(1);
          }}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            showDeleted
              ? "bg-rose-600 text-white"
              : "border border-white/70 bg-white/80 text-slate-700 hover:border-violet-300 hover:bg-violet-50"
          }`}
        >
          {showDeleted ? "Lihat Aktif" : "Lihat Arsip"}
        </button>
        <button
          type="button"
          onClick={handleDownloadZip}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
        >
          Download All PDF (ZIP)
        </button>
        {categoryOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setCategory(option.value);
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              category === option.value
                ? "bg-slate-950 text-white shadow-lg shadow-slate-950/20"
                : "border border-white/70 bg-white/80 text-slate-700 hover:border-violet-300 hover:bg-violet-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <table className="min-w-full">
          <thead className="bg-slate-50/90">
            <tr>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Nomor Invoice</th>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Tanggal</th>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Kategori</th>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Dilayani</th>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Total Item</th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Total Penjualan</th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Keuntungan</th>
              <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  Memuat data invoice...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  Belum ada transaksi invoice
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-slate-100/80 hover:bg-violet-50/50 transition">
                  <td className="px-5 py-5 text-sm">
                    <div className="font-mono font-medium text-slate-900">
                      {transaction.invoiceNumber || `INV-${transaction.id.slice(-8).toUpperCase()}`}
                    </div>
                    {transaction.note && <div className="mt-1 text-xs text-slate-500">{transaction.note}</div>}
                  </td>
                  <td className="px-5 py-5 text-sm">
                    <p className="whitespace-nowrap text-slate-900">
                      {new Date(transaction.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(transaction.createdAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </td>
                  <td className="px-5 py-5 text-sm">
                    <span className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                      {categoryLabelMap[transaction.category]}
                    </span>
                  </td>
                  <td className="px-5 py-5 text-sm text-slate-700">
                    {transaction.servedByName || "-"}
                  </td>
                  <td className="px-5 py-5 text-sm text-slate-700">
                    {transaction.items?.length || 0}
                  </td>
                  <td className="px-5 py-5 text-sm text-right">
                    <p className="font-semibold text-slate-900">
                      Rp {transaction.totalAmount.toLocaleString("id-ID")}
                    </p>
                  </td>
                  <td className="px-5 py-5 text-sm text-right">
                    <p className={`font-semibold ${transaction.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      Rp {transaction.profit.toLocaleString("id-ID")}
                    </p>
                  </td>
                  <td className="px-5 py-5 text-sm">
                    <div className="flex flex-wrap justify-center gap-2">
                      <Link
                        href={`/invoice/${transaction.id}`}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDownload(transaction.id)}
                        className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                      >
                        Download
                      </button>
                      {showDeleted ? (
                        <button
                          type="button"
                          onClick={() => updateDeletedState(transaction.id, false)}
                          className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-emerald-700"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateDeletedState(transaction.id, true)}
                          className="inline-flex items-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-rose-700"
                        >
                          Arsipkan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-xl border border-white/70 bg-white/80 px-6 py-2.5 transition hover:bg-violet-50 disabled:opacity-50"
          >
            Previous
          </button>

          <span className="px-4 text-sm text-slate-600">
            Halaman {page} dari {totalPages} ({totalItems} invoice)
          </span>

          <button
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="rounded-xl border border-white/70 bg-white/80 px-6 py-2.5 transition hover:bg-violet-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
