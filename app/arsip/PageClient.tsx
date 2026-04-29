"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type ArchiveTab = "hp" | "aksesoris" | "voucher";

type Phone = { id: string; brand: string; type: string; imei: string; deleted: boolean; isHidden: boolean };
type Accessory = { id: string; code: string; name: string; deleted: boolean };
type Voucher = { id: string; code: string; name: string; deleted: boolean };

export default function ArsipPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<ArchiveTab>("hp");
  const [search, setSearch] = useState("");
  const [phones, setPhones] = useState<Phone[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchAll = useCallback(async () => {
    const [hpRes, accRes, vchRes] = await Promise.all([
      fetch(`/api/hp?page=1&limit=1000&search=${encodeURIComponent(search)}&deleted=true`),
      fetch(`/api/accessories?page=1&limit=1000&search=${encodeURIComponent(search)}&deleted=true`),
      fetch(`/api/vouchers?page=1&limit=1000&search=${encodeURIComponent(search)}&deleted=true`),
    ]);
    const [hpData, accData, vchData] = await Promise.all([hpRes.json(), accRes.json(), vchRes.json()]);
    setPhones(hpData.phones || []);
    setAccessories(accData.accessories || []);
    setVouchers(vchData.vouchers || []);
  }, [search]);

  useEffect(() => {
    if (status === "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchAll();
    }
  }, [status, fetchAll]);

  const rows = useMemo(() => {
    if (tab === "hp") return phones;
    if (tab === "aksesoris") return accessories;
    return vouchers;
  }, [tab, phones, accessories, vouchers]);

  const restore = async (id: string) => {
    if (tab === "hp") {
      await fetch("/api/hp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, deleted: false, isHidden: false }),
      });
    }
    if (tab === "aksesoris") {
      await fetch("/api/accessories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, deleted: false }),
      });
    }
    if (tab === "voucher") {
      await fetch("/api/vouchers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, deleted: false }),
      });
    }
    await fetchAll();
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <h1 className="text-3xl font-semibold">Arsip</h1>
        <p className="mt-2 text-sm text-white/70">Data yang sudah di-soft delete bisa dicari dan di-restore dari sini.</p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {[
          { id: "hp", label: "HP" },
          { id: "aksesoris", label: "Aksesoris" },
          { id: "voucher", label: "Voucher" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id as ArchiveTab)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === item.id ? "bg-slate-950 text-white" : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Cari nama, kode, IMEI..."
        />
      </div>

      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada data arsip.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {"brand" in row ? `${row.brand} ${row.type}` : row.name}
                  </p>
                  <p className="text-xs text-slate-500">{"imei" in row ? row.imei : row.code}</p>
                </div>
                <button
                  onClick={() => restore(row.id)}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Restore
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
