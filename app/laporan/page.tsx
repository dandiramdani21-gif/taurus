"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import * as XLSX from "xlsx";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface LaporanItem {
  id: string;
  date: string;
  type: string;
  productName: string;
  productCode: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  totalBuy: number;
  totalSell: number;
  profit: number;
  stockLeft: number;
}

interface SummaryData {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalTransactions: number;
  totalItemsSold: number;
}

export default function LaporanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LaporanItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalTransactions: 0,
    totalItemsSold: 0,
  });
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; total: number }[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetchLaporan();
  }, [startDate, endDate]);

  const fetchLaporan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/laporan?startDate=${startDate}&endDate=${endDate}`);
      const result = await res.json();
      setData(result.data || []);
      setSummary(result.summary || {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        totalTransactions: 0,
        totalItemsSold: 0,
      });
      setMonthlyData(result.monthlyData || []);
    } catch (error) {
      console.error("Error fetching laporan:", error);
    } finally {
      setLoading(false);
    }
  };

const exportToExcel = () => {
  // Data transaksi
  const exportData = data.map((item) => {
    const profitPerUnit = item.sellPrice - item.buyPrice;
    const totalModal = item.buyPrice * item.quantity;
    const totalJual = item.sellPrice * item.quantity;
    const totalKeuntungan = totalJual - totalModal;
    
    return {
      Tanggal: new Date(item.date).toLocaleDateString("id-ID"),
      Tipe: item.type === "SALE" ? "Penjualan" : "Pembelian",
      "Kode Produk": item.productCode,
      "Nama Produk": item.productName,
      Qty: item.quantity,
      "Harga Modal (Rp)": item.buyPrice,
      "Harga Jual (Rp)": item.sellPrice,
      "Keuntungan/Unit (Rp)": profitPerUnit,
      "Total Modal (Rp)": totalModal,
      "Total Jual (Rp)": totalJual,
      "Total Keuntungan (Rp)": item.type === "SALE" ? totalKeuntungan : 0,
    };
  });

  // Hitung total
  const totalModalAll = data.reduce((sum, item) => sum + (item.buyPrice * item.quantity), 0);
  const totalJualAll = data.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
  const totalKeuntunganAll = data.reduce((sum, item) => {
    if (item.type === "SALE") {
      const totalJual = item.sellPrice * item.quantity;
      const totalModal = item.buyPrice * item.quantity;
      return sum + (totalJual - totalModal);
    }
    return sum;
  }, 0);

  // Tambah baris total - menggunakan 0 untuk field number
  exportData.push({
    Tanggal: "",
    Tipe: "TOTAL",
    "Kode Produk": "",
    "Nama Produk": "",
    Qty: 0,
    "Harga Modal (Rp)": 0,
    "Harga Jual (Rp)": 0,
    "Keuntungan/Unit (Rp)": 0,
    "Total Modal (Rp)": totalModalAll,
    "Total Jual (Rp)": totalJualAll,
    "Total Keuntungan (Rp)": totalKeuntunganAll,
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Tanggal
    { wch: 12 }, // Tipe
    { wch: 15 }, // Kode Produk
    { wch: 30 }, // Nama Produk
    { wch: 8 },  // Qty
    { wch: 18 }, // Harga Modal
    { wch: 18 }, // Harga Jual
    { wch: 20 }, // Keuntungan/Unit
    { wch: 18 }, // Total Modal
    { wch: 18 }, // Total Jual
    { wch: 22 }, // Total Keuntungan
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan");
  XLSX.writeFile(wb, `laporan_keuangan_${startDate}_to_${endDate}.xlsx`);
};

  const chartData = {
    labels: monthlyData.map((d) => d.month),
    datasets: [
      {
        label: "Penjualan (Rp)",
        data: monthlyData.map((d) => d.total),
        backgroundColor: "rgba(147, 51, 234, 0.5)",
        borderColor: "rgb(147, 51, 234)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Penjualan Bulanan",
      },
    },
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-purple-600">Sedang memuat data...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Laporan Keuangan</h1>
        <p className="text-gray-500 mt-1">Laporan penjualan dan pembelian</p>
      </div>

      {/* Filter Tanggal */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>
          <div>
            <button
              onClick={fetchLaporan}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
            >
              Filter
            </button>
          </div>
          <div>
            <button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Pendapatan</p>
              <p className="text-xl font-bold text-gray-800">
                Rp {summary.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Modal</p>
              <p className="text-xl font-bold text-gray-800">
                Rp {summary.totalCost.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Keuntungan</p>
              <p className="text-xl font-bold text-gray-800">
                Rp {summary.totalProfit.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Transaksi</p>
              <p className="text-xl font-bold text-gray-800">{summary.totalTransactions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Item Terjual</p>
              <p className="text-xl font-bold text-gray-800">{summary.totalItemsSold}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Grafik Penjualan Bulanan
        </h2>
        <div className="h-80">
          {monthlyData.length > 0 ? (
            <Bar options={chartOptions} data={chartData} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Belum ada data penjualan
            </div>
          )}
        </div>
      </div>

{/* Tabel Laporan */}
<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Kode</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Produk</th>
          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Modal</th>
          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Jual</th>
          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Keuntungan/Unit</th>
          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total Modal</th>
          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total Jual</th>
          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total Keuntungan</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {data.length === 0 ? (
          <tr>
            <td colSpan={11} className="text-center py-12 text-gray-500">
              Tidak ada data laporan
            </td>
          </tr>
        ) : (
          data.map((item, idx) => {
            const profitPerUnit = item.sellPrice - item.buyPrice;
            const totalModal = item.buyPrice * item.quantity;
            const totalJual = item.sellPrice * item.quantity;
            const totalKeuntungan = totalJual - totalModal;
            
            return (
              <tr key={idx} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(item.date).toLocaleDateString("id-ID")}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    item.type === "SALE" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {item.type === "SALE" ? "Penjualan" : "Pembelian"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-500">{item.productCode}</td>
                <td className="px-4 py-3 text-sm text-gray-800">{item.productName}</td>
                <td className="px-4 py-3 text-sm text-center font-medium">{item.quantity}</td>
                <td className="px-4 py-3 text-sm text-right">Rp {item.buyPrice.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right">Rp {item.sellPrice.toLocaleString()}</td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${profitPerUnit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  Rp {profitPerUnit.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right">Rp {totalModal.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">Rp {totalJual.toLocaleString()}</td>
                <td className={`px-4 py-3 text-sm text-right font-semibold ${totalKeuntungan >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {item.type === "SALE" ? `Rp ${totalKeuntungan.toLocaleString()}` : "-"}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
      {/* Footer Total */}
      {data.length > 0 && (
        <tfoot className="bg-gray-100 border-t-2 border-gray-300">
          <tr>
            <td colSpan={5} className="px-4 py-4 text-right font-bold text-gray-800">
              TOTAL
            </td>
            <td className="px-4 py-4 text-right font-bold text-gray-800">
              {/* Harga Modal - tidak dijumlah karena beda unit */}
              -
            </td>
            <td className="px-4 py-4 text-right font-bold text-gray-800">
              -
            </td>
            <td className="px-4 py-4 text-right font-bold text-gray-800">
              -
             </td>
            <td className="px-4 py-4 text-right font-bold text-purple-700">
              Rp {data.reduce((sum, item) => sum + (item.buyPrice * item.quantity), 0).toLocaleString()}
             </td>
            <td className="px-4 py-4 text-right font-bold text-purple-700">
              Rp {data.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0).toLocaleString()}
             </td>
            <td className="px-4 py-4 text-right font-bold text-green-700">
              Rp {data.reduce((sum, item) => {
                if (item.type === "SALE") {
                  const totalJual = item.sellPrice * item.quantity;
                  const totalModal = item.buyPrice * item.quantity;
                  return sum + (totalJual - totalModal);
                }
                return sum;
              }, 0).toLocaleString()}
             </td>
          </tr>
        </tfoot>
      )}
    </table>
  </div>
</div>

      {/* Footer Info */}
      <div className="text-center text-sm text-gray-400 mt-4">
        Menampilkan {data.length} transaksi dari periode {new Date(startDate).toLocaleDateString("id-ID")} - {new Date(endDate).toLocaleDateString("id-ID")}
      </div>
    </div>
  );
}