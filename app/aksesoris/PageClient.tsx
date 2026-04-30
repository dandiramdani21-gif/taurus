"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";
import SpreadsheetActions from "@/components/SpreadsheetActions";
import * as XLSX from "xlsx";

interface Accessory {
  id: string;
  name: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  image: string | null;
  entryDate: string;
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Summaries {
  profits: number
  total_assets: number
  total_solds: number
}

export default function AksesorisPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [summaries, setSummaries] = useState<Summaries>({
    profits: 0,
    total_assets: 0,
    total_solds: 0
  })
  const [showStockModal, setShowStockModal] = useState<Accessory | null>(null);
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null);
  const [stockValue, setStockValue] = useState(0);

  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    costPrice: "",
    sellPrice: "",
    stock: "0",
    image: "",
    entryDate: new Date().toISOString().split("T")[0],
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetchAccessories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, debouncedSearch]);

  const fetchAccessories = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/accessories?page=${pagination.page}&limit=${pagination.limit}&search=${debouncedSearch}`
      );
      const data = await res.json();
      setAccessories(data.accessories || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      setSummaries(data.summaries)
    } catch (error) {
      console.error("Error fetching accessories:", error);
    } finally {
      setLoading(false);
    }
  };


  const downloadTemplate = () => {
    try {
      // Data dummy dengan key yang sama seperti export
      const templateData = [
        {
          NAMA: "Tempered Glass iPhone 15",
          HARGA_MODAL: 25000,
          HARGA_JUAL: 50000,
          STOK: 10,
          TGL_MASUK: new Date().toISOString().split("T")[0],
        },
        {
          NAMA: "Casing Samsung A54",
          HARGA_MODAL: 35000,
          HARGA_JUAL: 75000,
          STOK: 15,
          TGL_MASUK: new Date().toISOString().split("T")[0],
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);

      // Set header background to gray
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:E1');
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = {
          fill: {
            fgColor: { rgb: "D3D3D3" }
          },
          font: {
            bold: true
          }
        };
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template Aksesoris");
      XLSX.writeFile(wb, `Template_Aksesoris_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Gagal mendownload template aksesoris");
    }
  };

const exportAccessories = async () => {
  try {
    const response = await fetch("/api/accessories/exports");
    if (!response.ok) {
      throw new Error("Gagal mengambil data Accessories");
    }
    
    const data = await response.json();
    const accessories = data.accessories;
    const solds = data.solds;
    
    // Sheet 1: Daftar Accessories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accessoryData = accessories.map((item: any, index: number) => ({
      NO: index + 1,
      KODE: item.code,
      NAMA: item.name,
      HARGA_MODAL: item.costPrice,
      HARGA_JUAL: item.sellPrice,
      STOK: item.stock,
      TGL_MASUK: item.entryDate ? new Date(item.entryDate).toISOString().split("T")[0] : "",
    }));

    // Sheet 2: Accessories Terjual
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const soldData = solds.map((item: any, index: number) => ({
      NO: index + 1,
      KODE: item.code,
      NAMA: item.name,
      HARGA_MODAL: item.costPrice,
      HARGA_JUAL: item.sellPrice,
      QTY: item.quantity,
      TGL_TERJUAL: item.soldDate ? new Date(item.soldDate).toISOString().split("T")[0] : "",
      KEUNTUNGAN: item.sellPrice - item.costPrice,
    }));

    const wb = XLSX.utils.book_new();

    // Sheet 1: Daftar Accessories
    const wsAccessories = XLSX.utils.json_to_sheet(accessoryData);
    
    wsAccessories['!cols'] = [
      { wch: 5 },   // NO
      { wch: 15 },  // KODE
      { wch: 30 },  // NAMA
      { wch: 15 },  // HARGA_MODAL
      { wch: 15 },  // HARGA_JUAL
      { wch: 10 },  // STOK
      { wch: 15 },  // TGL_MASUK
    ];
    
    const rangeAccessories = XLSX.utils.decode_range(wsAccessories['!ref'] || 'A1:G1');
    for (let col = rangeAccessories.s.c; col <= rangeAccessories.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!wsAccessories[cellAddress]) continue;
      wsAccessories[cellAddress].s = {
        fill: {
          fgColor: { rgb: "D3D3D3" }
        },
        font: {
          bold: true
        }
      };
    }

    // Format currency
    for (let row = 1; row <= accessoryData.length; row++) {
      const modalCell = XLSX.utils.encode_cell({ r: row, c: 3 });
      const jualCell = XLSX.utils.encode_cell({ r: row, c: 4 });
      if (wsAccessories[modalCell]) wsAccessories[modalCell].z = '#,##0';
      if (wsAccessories[jualCell]) wsAccessories[jualCell].z = '#,##0';
    }

    XLSX.utils.book_append_sheet(wb, wsAccessories, "Daftar Aksesoris");

    // Sheet 2: Accessories Terjual
    const wsSolds = XLSX.utils.json_to_sheet(soldData);
    
    wsSolds['!cols'] = [
      { wch: 5 },   // NO
      { wch: 15 },  // KODE
      { wch: 30 },  // NAMA
      { wch: 15 },  // HARGA_MODAL
      { wch: 15 },  // HARGA_JUAL
      { wch: 10 },  // QTY
      { wch: 15 },  // TGL_TERJUAL
      { wch: 15 },  // KEUNTUNGAN
    ];
    
    const rangeSolds = XLSX.utils.decode_range(wsSolds['!ref'] || 'A1:H1');
    for (let col = rangeSolds.s.c; col <= rangeSolds.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!wsSolds[cellAddress]) continue;
      wsSolds[cellAddress].s = {
        fill: {
          fgColor: { rgb: "FFD700" }
        },
        font: {
          bold: true
        }
      };
    }

    // Format currency
    for (let row = 1; row <= soldData.length; row++) {
      const modalCell = XLSX.utils.encode_cell({ r: row, c: 3 });
      const jualCell = XLSX.utils.encode_cell({ r: row, c: 4 });
      const untungCell = XLSX.utils.encode_cell({ r: row, c: 7 });
      if (wsSolds[modalCell]) wsSolds[modalCell].z = '#,##0';
      if (wsSolds[jualCell]) wsSolds[jualCell].z = '#,##0';
      if (wsSolds[untungCell]) wsSolds[untungCell].z = '#,##0';
    }

    XLSX.utils.book_append_sheet(wb, wsSolds, "Aksesoris Terjual");
    XLSX.writeFile(wb, `Aksesoris_Inventory_${new Date().toISOString().split("T")[0]}.xlsx`);
  } catch (error) {
    console.error("Error exporting accessories:", error);
    alert("Gagal mengekspor data aksesoris");
  }
};

  const importAccessories = async (rows: Record<string, string | number | null | undefined>[]) => {
    for (const row of rows) {
      const name = String(row.NAMA || row.NAMA || "").trim();
      if (!name) continue;

      const payload = {
        name,
        costPrice: Number(row["HARGA_MODAL"] ?? row.costPrice ?? 0),
        sellPrice: Number(row["HARGA_JUAL"] ?? row.sellPrice ?? 0),
        stock: Number(row.STOK ?? row.STOK ?? 0),
        entryDate: row["TGL_MASUK"] || row.entryDate || new Date().toISOString().split("T")[0],
      };

      const res = await fetch("/api/accessories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `Gagal import data ${name}`);
      }
    }

    await fetchAccessories();
    alert("Import inventory aksesoris selesai");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parseInt(formData.stock) < 0) {
      alert("Stok tidak boleh minus!");
      return;
    }

    const url = editingAccessory ? "/api/accessories" : "/api/accessories";
    const method = editingAccessory ? "PUT" : "POST";

    const body = editingAccessory
      ? { ...formData, id: editingAccessory.id }
      : formData;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        fetchAccessories();
        setShowModal(false);
        resetForm();
        alert(editingAccessory ? "Aksesoris berhasil diupdate!" : "Aksesoris berhasil ditambahkan!");
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan data");
      }
    } catch (error) {
      console.error("Error saving accessory:", error);
      alert("Terjadi kesalahan saat menyimpan data");
    }
  };

  const handleEdit = (item: Accessory) => {
    setEditingAccessory(item);
    setFormData({
      name: item.name,
      costPrice: item.costPrice.toString(),
      sellPrice: item.sellPrice.toString(),
      stock: item.stock.toString(),
      image: item.image || "",
      entryDate: item.entryDate
        ? new Date(item.entryDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingAccessory(null);
    setFormData({
      name: "",
      costPrice: "",
      sellPrice: "",
      stock: "0",
      image: "",
      entryDate: new Date().toISOString().split("T")[0],
    });
  };

  const updateStock = async (id: string, newStock: number) => {
    if (newStock < 0) {
      alert("Stok tidak boleh minus!");
      return;
    }

    try {
      const res = await fetch("/api/accessories/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stock: newStock }),
      });

      if (res.ok) {
        fetchAccessories();
        setShowStockModal(null);
        alert("Stok berhasil diupdate!");
      } else {
        alert("Gagal mengupdate stok");
      }
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Gagal mengupdate stok");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus aksesoris ini?")) return;

    try {
      const res = await fetch(`/api/accessories?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchAccessories();
        alert("Aksesoris berhasil dihapus!");
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menghapus data");
      }
    } catch (error) {
      console.error("Error deleting accessory:", error);
      alert("Gagal menghapus data");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID");
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-purple-600">Sedang memuat data...</div>
      </div>
    );
  }

  const totalStock = accessories.reduce((sum, item) => sum + (item.stock || 0), 0);
  const lowStockCount = accessories.filter((item) => item.stock > 0 && item.stock < 3).length;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Aksesoris</h1>
          <p className="text-gray-500 mt-1">Kelola data aksesoris yang tersedia</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Aksesoris
        </button>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SpreadsheetActions
          exportLabel="Export Aksesoris"
          importLabel="Import Aksesoris"
          onExport={exportAccessories}
          onImportRows={importAccessories}
        />
      </div>
      <div className="template">
        <p>Download template spreedsheet untuk import data aksesoris <button className="hover:underline text-blue-500" onClick={downloadTemplate}>Disini</button></p>
      </div>
      <br />
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari kode atau nama aksesoris..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Aksesoris</p>
              <p className="text-xl font-bold text-gray-800">{pagination.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Stok</p>
              <p className="text-xl font-bold text-gray-800">{totalStock}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Stok Menipis (&lt;3)</p>
              <p className="text-xl font-bold text-orange-600">{lowStockCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Aset</p>
              <p className="text-xl font-bold text-gray-800">Rp. {summaries.total_assets.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Terjual</p>
              <p className="text-xl font-bold text-gray-800">{summaries.total_solds}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Keuntungan</p>
              <p className="text-xl font-bold text-gray-800">Rp. {summaries.profits.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-purple-600">Loading...</div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Gambar</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Modal</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Jual</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stok</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Masuk</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {accessories.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        Belum ada data aksesoris
                      </td>
                    </tr>
                  ) : (
                    accessories.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">Rp {item.costPrice.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">Rp {item.sellPrice.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          {item.stock === 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Habis</span>
                          ) : item.stock < 3 ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Stok: {item.stock}
                              </span>
                              <span className="text-xs text-orange-500">⚠️ Segera restok</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Stok: {item.stock}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(item.entryDate)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setShowStockModal(item);
                                setStockValue(item.stock);
                              }}
                              className="text-green-600 hover:text-green-800"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </button>
                            <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum = pagination.page <= 3
                    ? i + 1
                    : pagination.page >= pagination.totalPages - 2
                      ? pagination.totalPages - 4 + i
                      : pagination.page - 2 + i;

                  if (pagination.totalPages <= 5) pageNum = i + 1;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPagination((prev) => ({ ...prev, page: pageNum }))}
                      className={`px-3 py-1 rounded-lg transition ${pagination.page === pageNum
                          ? "bg-purple-600 text-white"
                          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          <div className="text-center text-sm text-gray-500 mt-3">
            Menampilkan {accessories.length} dari {pagination.total} data
          </div>
        </>
      )}

      {/* Modal Stock */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Atur Stok</h2>
              <button onClick={() => setShowStockModal(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Aksesoris</p>
                <p className="font-medium">{showStockModal.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Stok</label>
                <input
                  type="number"
                  min="0"
                  value={stockValue}
                  onChange={(e) => setStockValue(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => updateStock(showStockModal.id, stockValue)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg"
                >
                  Simpan
                </button>
                <button
                  onClick={() => setShowStockModal(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md p-6 my-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingAccessory ? "Edit Aksesoris" : "Tambah Aksesoris"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Aksesoris *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Modal (Rp) *</label>
                  <input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    value={formData.sellPrice}
                    onChange={(e) => setFormData({ ...formData, sellPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Masuk</label>
                  <input
                    type="date"
                    value={formData.entryDate}
                    onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto Aksesoris</label>
                <ImageUploader
                  onImageCapture={(imageData) => setFormData({ ...formData, image: imageData })}
                  currentImage={formData.image}
                />
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg transition"
                >
                  {editingAccessory ? "Update Aksesoris" : "Simpan Aksesoris"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg transition"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
