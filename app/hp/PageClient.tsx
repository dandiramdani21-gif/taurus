"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";
import SpreadsheetActions from "@/components/SpreadsheetActions";
import * as XLSX from "xlsx";

interface Metadata {
  key: string;
  value: string;
}

interface Phone {
  id: string;
  brand: string;
  type: string;
  imei: string;
  color: string | null;
  purchasePrice: number;
  purchaseDate: string;
  stock: number;
  image: string | null;
  metadata: Metadata[];
  entryDate: Date
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Summaries {
  totalPurchasePrice: number;
  totalSoldCount: number
}

export default function HpPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: session, status } = useSession();
  const router = useRouter();
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState<Phone | null>(null);
  const [editingPhone, setEditingPhone] = useState<Phone | null>(null);
  const [stockValue, setStockValue] = useState(0);
  const [summaries, setSummaries] = useState<Summaries>({ totalPurchasePrice: 0, totalSoldCount: 9 })
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");


  const [formData, setFormData] = useState({
    brand: "",
    type: "",
    imei: "",
    color: "",
    purchasePrice: "",
    stock: "1",
    image: "",
    entryDate: new Date().toISOString().split("T")[0], // default hari ini
  });
  const [metadata, setMetadata] = useState<Metadata[]>([
    { key: "RAM", value: "" },
    { key: "Camera", value: "" },
  ]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetchPhones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, debouncedSearch]);

  const fetchPhones = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hp?page=${pagination.page}&limit=${pagination.limit}&search=${debouncedSearch}`);
      const data = await res.json();
      setPhones(data.phones);
      setPagination(data.pagination);
      setSummaries(data.summaries)
    } catch (error) {
      console.error("Error fetching phones:", error);
    } finally {
      setLoading(false);
    }
  };

  const parseImportDate = (value: unknown) => {
    if (!value) return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const month = String(parsed.m).padStart(2, "0");
        const day = String(parsed.d).padStart(2, "0");
        return `${parsed.y}-${month}-${day}`;
      }
    }

    const text = String(value).trim();
    if (!text) return "";

    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      return text.slice(0, 10);
    }

    const parts = text.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts.map((part) => part.trim());
      if (day && month && year) {
        return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }

    const fallback = new Date(text);
    if (!Number.isNaN(fallback.getTime())) {
      const year = fallback.getFullYear();
      const month = String(fallback.getMonth() + 1).padStart(2, "0");
      const day = String(fallback.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return "";
  };

  const downloadTemplate = () => {
    try {
      // Data template dengan 2 contoh dummy
      const templateData = [
        {
          MERK: "OPPO",
          TIPE: "A13 6/64",
          IMEI: "4837248732842",
          WARNA: "MERAH",
          HARGA: 1400000,
          TGL_BELI: new Date().toISOString().split("T")[0],
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);

      // Set header background to gray
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:G1');
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = {
          fill: {
            fgColor: { rgb: "D3D3D3" } // Abu-abu
          },
          font: {
            bold: true
          }
        };
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template HP");
      XLSX.writeFile(wb, `Template_HP_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Gagal mendownload template hp");
    }
  };

  const exportPhones = async () => {
    try {
      const response = await fetch("/api/hp/exports");
      if (!response.ok) {
        throw new Error("Gagal mengambil data HP");
      }

      const data = await response.json();
      const phones = data.phones;
      const solds = data.solds;

      // Sheet 1: Daftar HP
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phoneData = phones.map((phone: any, index: number) => ({
        NO: index + 1,
        MERK: phone.brand,
        TIPE: phone.type,
        IMEI: phone.imei,
        WARNA: phone.color || "",
        TGL_BELI: phone.entryDate
          ? new Date(phone.entryDate).toISOString().split("T")[0]
          : "",
        HARGA_MODAL: phone.purchasePrice,
      }));

      // Sheet 2: HP Terjual
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const soldData = solds.map((sold: any, index: number) => ({
        NO: index + 1,
        MERK: sold.brand,
        TIPE: sold.type,
        IMEI: sold.imei,
        WARNA: sold.color || "",
        TGL_BELI: sold.entryDate
          ? new Date(sold.entryDate).toISOString().split("T")[0]
          : "",
        HARGA_MODAL: sold.purchasePrice,
        HARGA_JUAL: sold.sellPrice,
        TGL_TERJUAL: sold.soldDate
          ? new Date(sold.soldDate).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
          : "",
        KEUNTUNGAN: sold.sellPrice - sold.purchasePrice,
      }));

      // Buat workbook baru
      const wb = XLSX.utils.book_new();

      // Sheet 1: Daftar HP
      const wsPhones = XLSX.utils.json_to_sheet(phoneData);

      // Set column widths untuk sheet Daftar HP
      wsPhones['!cols'] = [
        { wch: 5 },   // NO
        { wch: 15 },  // MERK
        { wch: 20 },  // TIPE
        { wch: 20 },  // IMEI
        { wch: 15 },  // WARNA
        { wch: 15 },  // TGL_BELI
        { wch: 15 },  // HARGA_MODAL
      ];

      // Set header style untuk sheet Daftar HP
      const rangePhones = XLSX.utils.decode_range(wsPhones['!ref'] || 'A1:G1');
      for (let col = rangePhones.s.c; col <= rangePhones.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!wsPhones[cellAddress]) continue;
        wsPhones[cellAddress].s = {
          fill: {
            fgColor: { rgb: "D3D3D3" }
          },
          font: {
            bold: true
          },
          alignment: {
            horizontal: "center",
            vertical: "center"
          }
        };
      }

      // Format currency untuk HARGA_MODAL di sheet Daftar HP
      for (let row = 1; row <= phoneData.length; row++) {
        const hargaCell = XLSX.utils.encode_cell({ r: row, c: 6 });
        if (wsPhones[hargaCell]) {
          wsPhones[hargaCell].z = '#,##0';
        }
      }

      XLSX.utils.book_append_sheet(wb, wsPhones, "Daftar HP");

      // Sheet 2: HP Terjual
      const wsSolds = XLSX.utils.json_to_sheet(soldData);

      // Set column widths untuk sheet HP Terjual
      wsSolds['!cols'] = [
        { wch: 5 },   // NO
        { wch: 15 },  // MERK
        { wch: 20 },  // TIPE
        { wch: 20 },  // IMEI
        { wch: 15 },  // WARNA
        { wch: 15 },  // TGL_BELI
        { wch: 15 },  // HARGA_MODAL
        { wch: 15 },  // HARGA_JUAL
        { wch: 15 },  // TGL_TERJUAL
        { wch: 15 },  // KEUNTUNGAN
      ];

      // Set header style untuk sheet HP Terjual
      const rangeSolds = XLSX.utils.decode_range(wsSolds['!ref'] || 'A1:J1');
      for (let col = rangeSolds.s.c; col <= rangeSolds.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!wsSolds[cellAddress]) continue;
        wsSolds[cellAddress].s = {
          fill: {
            fgColor: { rgb: "FFD700" } // Gold untuk membedakan
          },
          font: {
            bold: true
          },
          alignment: {
            horizontal: "center",
            vertical: "center"
          }
        };
      }

      // Format currency untuk HARGA_MODAL, HARGA_JUAL, KEUNTUNGAN di sheet HP Terjual
      for (let row = 1; row <= soldData.length; row++) {
        const modalCell = XLSX.utils.encode_cell({ r: row, c: 6 });
        const jualCell = XLSX.utils.encode_cell({ r: row, c: 7 });
        const untungCell = XLSX.utils.encode_cell({ r: row, c: 9 });

        if (wsSolds[modalCell]) wsSolds[modalCell].z = '#,##0';
        if (wsSolds[jualCell]) wsSolds[jualCell].z = '#,##0';
        if (wsSolds[untungCell]) wsSolds[untungCell].z = '#,##0';
      }

      XLSX.utils.book_append_sheet(wb, wsSolds, "HP Terjual");

      // Download file
      XLSX.writeFile(wb, `HP_Inventory_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (error) {
      console.error("Error exporting phones:", error);
      alert("Gagal mengekspor data HP");
    }
  };

  const importPhones = async (rows: Array<Record<string, unknown>>) => {
    if (!rows.length) {
      alert("File import kosong");
      return;
    }

    for (const row of rows) {
      const merk = String(row.MERK || row.merk || "").trim();
      const tipe = String(row.TIPE || row.tipe || "").trim();
      const imei = String(row.IMEI || row.imei || "").trim();
      const warna = String(row.WARNA || row.warna || "").trim();
      const tglBeli = parseImportDate(row.TGL_BELI || row.tgl_beli || row["TGL BELI"]);
      const harga = Number(String(row.HARGA ?? row.harga ?? "0").replace(/[^\d-]/g, ""));

      if (!imei) continue;

      const payload = {
        brand: merk,
        type: tipe,
        imei,
        color: warna,
        purchasePrice: harga,
        stock: 1,
        image: "",
        metadata: [],
        purchaseDate: tglBeli || new Date().toISOString().split("T")[0],
        entryDate: tglBeli || new Date().toISOString().split("T")[0],
      };

      const existing = await checkExistingImei(imei);
      if (existing.exists) {
        continue;
      }

      const res = await fetch("/api/hp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || `Gagal import data ${imei}`);
      }
    }

    await fetchPhones();
    alert("Import inventory HP selesai");
  };

  // Cek apakah kode sudah ada
  const checkExistingImei = async (imei: string) => {
    try {
      const res = await fetch(`/api/hp/check?imei=${imei}`);
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Error checking IMEI:", error);
      return { exists: false };
    }
  };
  const updateStock = async (id: string, newStock: number) => {
    if (newStock < 0) {
      alert("Stok tidak boleh minus!");
      return;
    }

    try {
      const res = await fetch(`/api/hp/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stock: newStock }),
      });

      if (res.ok) {
        fetchPhones();
        setShowStockModal(null);
      } else {
        alert("Gagal update stok");
      }
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Gagal update stok");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parseInt(formData.stock) < 0) {
      alert("Stok tidak boleh minus!");
      return;
    }

    const filteredMetadata = metadata.filter(m => m.key && m.value);

    const url = editingPhone ? "/api/hp" : "/api/hp";
    const method = editingPhone ? "PUT" : "POST";
    const body = editingPhone
      ? { ...formData, id: editingPhone.id, metadata: filteredMetadata }
      : { ...formData, metadata: filteredMetadata };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        fetchPhones();
        setShowModal(false);
        resetForm();
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error("Error saving phone:", error);
      alert("Gagal menyimpan data");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus HP ini?")) return;

    try {
      const res = await fetch(`/api/hp?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchPhones();
      } else {
        alert("Gagal menghapus data");
      }
    } catch (error) {
      console.error("Error deleting phone:", error);
      alert("Gagal menghapus data");
    }
  };

  const handleEdit = (phone: Phone) => {
    setEditingPhone(phone);
    setFormData({
      brand: phone.brand,
      type: phone.type,
      imei: phone.imei,
      color: phone.color || "",
      purchasePrice: phone.purchasePrice.toString(),
      stock: phone.stock.toString(),
      image: phone.image || "",
      entryDate: phone.entryDate ? new Date(phone.entryDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    });

    if (phone.metadata && phone.metadata.length > 0) {
      setMetadata(phone.metadata);
    } else {
      setMetadata([
        { key: "RAM", value: "" },
        { key: "Camera", value: "" },
      ]);
    }
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingPhone(null);
    setFormData({
      brand: "",
      type: "",
      imei: "",
      color: "",
      purchasePrice: "",
      stock: "1",
      image: "",
      entryDate: new Date().toISOString().split("T")[0],
    });
    setMetadata([
      { key: "RAM", value: "" },
      { key: "Camera", value: "" },
    ]);
  };

  const addMetadata = () => {
    setMetadata([...metadata, { key: "", value: "" }]);
  };

  const removeMetadata = (index: number) => {
    const newMetadata = [...metadata];
    newMetadata.splice(index, 1);
    setMetadata(newMetadata);
  };

  const updateMetadata = (index: number, field: "key" | "value", value: string) => {
    const newMetadata = [...metadata];
    newMetadata[index][field] = value;
    setMetadata(newMetadata);
  };

  const goToPage = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-purple-600">Sedang memuat data...</div>
      </div>
    );
  }

  const totalStock = phones.reduce((sum, phone) => sum + phone.stock, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daftar HP</h1>
          <p className="text-gray-500 mt-1">Kelola data HP yang tersedia</p>
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
          Tambah HP
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SpreadsheetActions
          exportLabel="Export HP"
          importLabel="Import HP"
          onExport={exportPhones}
          onImportRows={importPhones}
        />


      </div>

      <div className="template">
        <p>Download template spreedsheet untuk import data hp <button className="hover:underline text-blue-500" onClick={downloadTemplate}>Disini</button></p>
      </div>
      <br />

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari berdasarkan brand atau type..."
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
              <p className="text-sm text-gray-500">Total HP</p>
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
              <p className="text-sm text-gray-500">Total Aset</p>
              <p className="text-xl font-bold text-gray-800">Rp. {summaries.totalPurchasePrice.toLocaleString()}</p>
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
              <p className="text-sm text-gray-500">Barang Terjual</p>
              <p className="text-xl font-bold text-gray-800">{summaries.totalSoldCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-purple-600">Loading...</div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Gambar</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Barang</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Imei</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Masuk</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {phones.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-500">
                        Tidak ada data HP
                      </td>
                    </tr>
                  ) : (
                    phones.map((phone) => (
                      <tr key={phone.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                            {phone.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={phone.image} alt={phone.brand} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{phone.brand}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{phone.type}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">Rp {phone.purchasePrice.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {phone.imei}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(phone.entryDate).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(phone)} className="text-blue-600 hover:text-blue-800">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(phone.id)} className="text-red-600 hover:text-red-800">
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
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
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
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Info */}
          <div className="text-center text-sm text-gray-500 mt-3">
            Menampilkan {phones.length} dari {pagination.total} data
          </div>
        </>
      )}

      {/* Modal Stock */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Atur Stok</h2>
              <button onClick={() => setShowStockModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">HP</p>
                <p className="font-medium">{showStockModal.brand} {showStockModal.type}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Stok</label>
                <input
                  type="number"
                  min="0"
                  value={stockValue}
                  onChange={(e) => setStockValue(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">Stok tidak boleh minus</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => updateStock(showStockModal.id, stockValue)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition"
                >
                  Simpan
                </button>
                <button
                  onClick={() => setShowStockModal(null)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition"
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
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingPhone ? "Edit HP" : "Tambah HP"}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                    required
                  />
                </div>
              </div>

              {/* IMEI with Scanner */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IMEI *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.imei}
                    onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warna</label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Modal *</label>
                  <input
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Stok tidak boleh minus</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Masuk</label>
                  <input
                    type="date"
                    value={formData.entryDate}
                    onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Default: hari ini</p>
                </div>
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto HP</label>
                <ImageUploader
                  onImageCapture={(imageData) => setFormData({ ...formData, image: imageData })}
                  currentImage={formData.image}
                />
              </div>

              {/* Dynamic Metadata */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">Spesifikasi & Metadata</label>
                  <button type="button" onClick={addMetadata} className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah
                  </button>
                </div>

                <div className="space-y-2">
                  {metadata.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nama (contoh: RAM)"
                        value={item.key}
                        onChange={(e) => updateMetadata(idx, "key", e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Value (contoh: 8GB)"
                        value={item.value}
                        onChange={(e) => updateMetadata(idx, "value", e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeMetadata(idx)}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">Klik + untuk menambah metadata spesifikasi HP</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition">
                  {editingPhone ? "Update" : "Simpan"}
                </button>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition">
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
