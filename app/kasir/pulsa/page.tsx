"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function KasirPulsaPage() {
  const { status } = useSession();
  const router = useRouter();

  const [destinationNumber, setDestinationNumber] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [balance, setBalance] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchLastBalance = async () => {
      setLoadingBalance(true);
      try {
        const res = await fetch("/api/checkout/pulsa");
        if (!res.ok) return;

        const data = await res.json();
        if (data.balance !== null && data.balance !== undefined) {
          setBalance(String(data.balance));
        }
      } catch (error) {
        console.error("Error fetching last pulsa balance:", error);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchLastBalance();
  }, [status]);

  const profit = Math.max(0, Number(sellPrice || 0) - Number(costPrice || 0));
  const currentBalance = balance === "" ? null : Number(balance);
  const usedCost = Number(costPrice || 0);
  const remainingBalance =
    currentBalance !== null && Number.isFinite(currentBalance)
      ? Math.max(0, currentBalance - usedCost)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!destinationNumber.trim()) {
      alert("No tujuan wajib diisi");
      return;
    }

    if (currentBalance !== null && usedCost > currentBalance) {
      alert("Saldo tidak cukup untuk menutup modal transaksi ini");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout/pulsa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationNumber,
          costPrice: Number(costPrice || 0),
          balance: balance ? Number(balance) : null,
          sellPrice: Number(sellPrice || 0),
          description,
          note,
          totalAmount: Number(sellPrice || 0),
          totalCost: Number(costPrice || 0),
          profit: Number(sellPrice || 0) - Number(costPrice || 0),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal checkout pulsa");
        return;
      }

      if (data.balance !== null && data.balance !== undefined) {
        setBalance(String(data.balance));
      } else if (remainingBalance !== null) {
        setBalance(String(remainingBalance));
      }
      setDestinationNumber("");
      setCostPrice("");
      setSellPrice("");
      setDescription("");
      setNote("");
      alert("Checkout pulsa berhasil");
    } catch (error) {
      console.error("Error checkout pulsa:", error);
      alert("Gagal checkout pulsa");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <div className="flex items-center justify-center h-96 text-purple-600">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="px-6 py-8 lg:px-10 lg:py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
            Quick Sell
          </div>
          <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Kasir Pulsa</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            Form transaksi langsung tanpa master data inventory, dibuat lebih ringkas dan nyaman dipakai di meja kasir.
          </p>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-600">No Tujuan</label>
            <input
              type="text"
              value={destinationNumber}
              onChange={(e) => setDestinationNumber(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-violet-500"
              placeholder="08xxxxxxxxxx"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">Modal</label>
            <input
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-violet-500"
              placeholder="0"
              min="0"
              onFocus={(e) => e.currentTarget.select()}
            />
            {remainingBalance !== null && (
              <p className="mt-1 text-xs text-slate-500">
                Sisa saldo setelah transaksi: Rp {remainingBalance.toLocaleString("id-ID")}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">Saldo</label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-violet-500"
              placeholder={loadingBalance ? "Memuat saldo terakhir..." : "Gunakan saldo terakhir"}
              min="0"
            />
            <p className="mt-1 text-xs text-slate-500">
              {loadingBalance
                ? "Mengambil sisa saldo terakhir..."
                : "Saldo ini otomatis dikurangi sesuai modal dan disimpan sebagai saldo sisa."}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">Harga Jual</label>
            <input
              type="number"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-violet-500"
              placeholder="0"
              min="0"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">Keuntungan</label>
            <div className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-500/20">
              Rp {profit.toLocaleString("id-ID")}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">Keterangan</label>
          <select
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Pilih keterangan</option>
            <option value="TAGOG">TAGOG</option>
            <option value="SHOPEEPAY">SHOPEEPAY</option>
            <option value="DIGIPOS">JG DIGIPOS</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">Note</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-violet-500"
            placeholder="Catatan tambahan"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Checkout Pulsa"}
        </button>

        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
            <div className="rounded-3xl border border-white/20 bg-white/95 px-6 py-5 text-center shadow-2xl">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
              <p className="text-sm font-semibold text-slate-900">Memproses checkout...</p>
              <p className="mt-1 text-xs text-slate-500">Mohon tunggu, jangan klik dua kali.</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
