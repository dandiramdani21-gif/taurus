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
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface DashboardData {
  totalRevenue: number;
  totalProfit: number;
  totalTransactions: number;
  totalProducts: number;
  recentTransactions: {
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  dailySales: { date: string; total: number }[];
  topProducts: { name: string; code: string; sold: number }[];
  stockAlerts: { name: string; code: string; stock: number; type: string }[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactionPage, setTransactionPage] = useState(1);
  const [productPage, setProductPage] = useState(1);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetchDashboardData();
  }, [transactionPage, productPage]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`/api/dashboard?transactionPage=${transactionPage}&productPage=${productPage}`);
      const result = await res.json();
      
      setData({
        totalRevenue: result.totalRevenue || 0,
        totalProfit: result.totalProfit || 0,
        totalTransactions: result.totalTransactions || 0,
        totalProducts: result.totalProducts || 0,
        recentTransactions: result.recentTransactions || { data: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 0 } },
        dailySales: result.dailySales || [],
        topProducts: result.topProducts || [],
        stockAlerts: result.stockAlerts || [],
      });
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-purple-600">Sedang memuat data...</div>
      </div>
    );
  }

  const barChartData = {
    labels: data.dailySales?.map((d) => d.date) || [],
    datasets: [
      {
        label: "Penjualan (Rp)",
        data: data.dailySales?.map((d) => d.total) || [],
        backgroundColor: "rgba(147, 51, 234, 0.5)",
        borderColor: "rgb(147, 51, 234)",
        borderWidth: 1,
      },
    ],
  };

  const doughnutChartData = {
    labels: data.topProducts?.map((p) => p.name) || [],
    datasets: [
      {
        data: data.topProducts?.map((p) => p.sold) || [],
        backgroundColor: [
          "rgba(147, 51, 234, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(245, 158, 11, 0.8)",
          "rgba(239, 68, 68, 0.8)",
        ],
        borderWidth: 0,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
      },
    },
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Selamat datang kembali, {session?.user?.name}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Pendapatan</p>
              <p className="text-2xl font-bold text-gray-800">
                Rp {data.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Keuntungan</p>
              <p className="text-2xl font-bold text-gray-800">
                Rp {data.totalProfit.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Transaksi</p>
              <p className="text-2xl font-bold text-gray-800">
                {data.totalTransactions}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Produk</p>
              <p className="text-2xl font-bold text-gray-800">
                {data.totalProducts}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Penjualan 7 Hari Terakhir
          </h2>
          <div className="h-80">
            {data.dailySales.length > 0 ? (
              <Bar options={barOptions} data={barChartData} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Belum ada data penjualan
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Produk Terlaris
          </h2>
          <div className="h-80">
            {data.topProducts.length > 0 ? (
              <Doughnut options={doughnutOptions} data={doughnutChartData} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Belum ada data penjualan
              </div>
            )}
          </div>
          {/* List top products */}
          {data.topProducts.length > 0 && (
            <div className="mt-4 space-y-2">
              {data.topProducts.map((product, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{product.name}</span>
                    <span className="text-xs text-gray-400 ml-2">({product.code})</span>
                  </div>
                  <span className="text-purple-600 font-semibold">Terjual: {product.sold}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions with Pagination & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                Transaksi Terbaru
              </h2>
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {data.recentTransactions.data.length > 0 ? (
              data.recentTransactions.data.map((transaction, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-800">
                        {transaction.type === "SALE" ? "🛒 Penjualan" : "📦 Pembelian"}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(transaction.createdAt).toLocaleString("id-ID")}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {transaction.items?.length || 0} item
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        Rp {transaction.totalAmount?.toLocaleString() || 0}
                      </p>
                      <p className="text-sm text-gray-500">
                        Profit: Rp {transaction.profit?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                Belum ada transaksi
              </div>
            )}
          </div>
          {/* Pagination for Transactions */}
          {data.recentTransactions.pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex justify-center gap-2">
              <button
                onClick={() => setTransactionPage(p => Math.max(1, p - 1))}
                disabled={data.recentTransactions.pagination.page === 1}
                className="px-3 py-1 rounded border disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm">
                {data.recentTransactions.pagination.page} / {data.recentTransactions.pagination.totalPages}
              </span>
              <button
                onClick={() => setTransactionPage(p => Math.min(data.recentTransactions.pagination.totalPages, p + 1))}
                disabled={data.recentTransactions.pagination.page === data.recentTransactions.pagination.totalPages}
                className="px-3 py-1 rounded border disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Stock Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                ⚠️ Stok Menipis
              </h2>
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {data.stockAlerts.length > 0 ? (
              data.stockAlerts.map((item, idx) => (
                <div key={idx} className="p-4 flex justify-between items-center">
                  <div>
                    <span className="text-gray-800">{item.name}</span>
                    <span className="text-xs text-gray-400 ml-2">({item.code})</span>
                    {item.type === "Phone" && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1 rounded">HP</span>
                    )}
                  </div>
                  <span className={`text-sm font-medium px-2 py-1 rounded ${
                    item.stock === 1 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                  }`}>
                    Stok: {item.stock}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                ✅ Semua stok aman
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}