// app/laporan/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import * as XLSX from "xlsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DailyReport {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

export default function LaporanKeuanganPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [productFilter, setProductFilter] = useState<"all" | "phone" | "accessory" | "voucher" | "pulsa">("all");
  const [search, setSearch] = useState("");

  // Ringkasan
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);

  // Chart Data
  const [chartData, setChartData] = useState<DailyReport[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") fetchLaporan();
  }, [status, startDate, endDate, productFilter, search]);

  const fetchLaporan = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/laporan?startDate=${startDate}&endDate=${endDate}&productType=${productFilter}`
      );
      const data = await res.json();

      setTransactions(data.transactions || []);
      setTotalRevenue(data.summary.totalRevenue);
      setTotalCost(data.summary.totalCost);
      setTotalProfit(data.summary.totalProfit);
      setChartData(data.chartData || []);
    } catch (error) {
      console.error("Gagal mengambil laporan:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const exportData = transactions.map((t: any) => ({
      Tanggal: format(new Date(t.createdAt), "dd/MM/yyyy HH:mm"),
      "Total Penjualan": t.totalAmount,
      "Total Modal": t.totalCost,
      Keuntungan: t.profit,
      Catatan: t.note || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan");

    // Tambah total di baris bawah
    XLSX.utils.sheet_add_aoa(ws, [
      ["TOTAL", totalRevenue, totalCost, totalProfit, ""],
    ], { origin: -1 });

    XLSX.writeFile(wb, `Laporan_Keuangan_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end border-b pb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Laporan Keuangan</h1>
          <p className="text-gray-500 mt-1">Analisis performa penjualan bisnis Anda</p>
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-medium transition shadow-sm"
        >
          📥 Export ke Excel
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Jenis Produk</label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value as any)}
              className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            >
              <option value="all">Semua Produk</option>
              <option value="phone">HP</option>
              <option value="accessory">Aksesoris</option>
              <option value="voucher">Voucher</option>
              <option value="pulsa">Pulsa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Cari Barang</label>
            <input
              type="text"
              placeholder="Nama barang atau kode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Pendapatan</p>
          <p className="text-4xl font-semibold text-emerald-600 mt-4">
            Rp {totalRevenue.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Modal</p>
          <p className="text-4xl font-semibold text-amber-600 mt-4">
            Rp {totalCost.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Keuntungan</p>
          <p className={`text-4xl font-semibold mt-4 ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            Rp {totalProfit.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

{/* Chart */}
<div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
  <h2 className="text-xl font-semibold mb-6">Perkembangan Keuntungan</h2>
  <div className="h-96">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
        <XAxis 
          dataKey="date" 
          stroke="#888" 
          fontSize={12}
          tickFormatter={(value) => value?.slice(5) || value}
        />
        <YAxis stroke="#888" fontSize={12} />

        <Tooltip 
          formatter={(value: any, name: string | number | undefined) => [
            `Rp ${Number(value || 0).toLocaleString("id-ID")}`,
            name === "profit" ? "Keuntungan" : name === "revenue" ? "Pendapatan" : ""
          ]}
          labelFormatter={(label: any) => `Tanggal: ${label}`}
          contentStyle={{
            borderRadius: "12px",
            border: "none",
            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            padding: "12px 16px",
          }}
        />

        <Legend />
        
        <Line 
          type="natural" 
          dataKey="profit" 
          stroke="#10b981" 
          strokeWidth={4} 
          dot={{ fill: "#10b981", r: 5 }}
          name="Keuntungan"
        />
        <Line 
          type="natural" 
          dataKey="revenue" 
          stroke="#6366f1" 
          strokeWidth={3} 
          strokeOpacity={0.7}
          name="Pendapatan"
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
</div>

      {/* Detail Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-800">Detail Transaksi</h2>
          <span className="text-sm text-gray-500">
            {transactions.length} transaksi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-8 py-4 text-left text-sm font-medium text-gray-600">Tanggal</th>
                <th className="px-8 py-4 text-left text-sm font-medium text-gray-600">Item</th>
                <th className="px-8 py-4 text-right text-sm font-medium text-gray-600">Pendapatan</th>
                <th className="px-8 py-4 text-right text-sm font-medium text-gray-600">Modal</th>
                <th className="px-8 py-4 text-right text-sm font-medium text-gray-600">Keuntungan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50 transition">
                  <td className="px-8 py-5 text-sm text-gray-600">
                    {new Date(t.createdAt).toLocaleString("id-ID")}
                  </td>
                  <td className="px-8 py-5">
                    {t.items.map((item: any, i: number) => (
                      <div key={i} className="text-sm text-gray-800">
                        {item.phone 
                          ? `${item.phone.brand} ${item.phone.type}` 
                          : item.accessory 
                          ? item.accessory.name 
                          : item.voucher 
                          ? item.voucher.name 
                          : item.pulsa 
                          ? `${item.pulsa.denomination.toLocaleString()} ${item.pulsa.note || ""}` 
                          : "-"}
                      </div>
                    ))}
                  </td>
                  <td className="px-8 py-5 text-right font-medium text-emerald-600">
                    Rp {t.totalAmount.toLocaleString("id-ID")}
                  </td>
                  <td className="px-8 py-5 text-right text-amber-600">
                    Rp {t.totalCost.toLocaleString("id-ID")}
                  </td>
                  <td className="px-8 py-5 text-right font-semibold text-emerald-600">
                    Rp {t.profit.toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}