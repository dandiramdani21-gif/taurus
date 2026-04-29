// app/pulsa/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";

interface Pulsa {
  id: string;
  code: string;
  denomination: number;
  costPrice: number;
  sellPrice: number;
  note: string | null;
  image: string | null;
  entryDate: string;     // meskipun tidak ada di schema, kita tetap tampilkan jika ada
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PulsaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [pulsaList, setPulsaList] = useState<Pulsa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<Pulsa | null>(null);
  const [editingPulsa, setEditingPulsa] = useState<Pulsa | null>(null);

  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    denomination: "",
    costPrice: "",
    sellPrice: "",
    note: "",
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
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    fetchPulsa();
  }, [pagination.page, debouncedSearch]);

  const fetchPulsa = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pulsa?page=${pagination.page}&limit=${pagination.limit}&search=${debouncedSearch}`);
      const data = await res.json();
      setPulsaList(data.pulsa || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
    } catch (error) {
      console.error("Error fetching pulsa:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = editingPulsa
      ? { ...formData, id: editingPulsa.id }
      : formData;

    try {
      const res = await fetch("/api/pulsa", {
        method: editingPulsa ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        fetchPulsa();
        setShowModal(false);
        resetForm();
        alert(editingPulsa ? "Pulsa berhasil diupdate!" : "Pulsa berhasil ditambahkan!");
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan data");
      }
    } catch (error) {
      console.error("Error saving pulsa:", error);
      alert("Terjadi kesalahan saat menyimpan data");
    }
  };

  const handleEdit = (item: Pulsa) => {
    setEditingPulsa(item);
    setFormData({
      code: item.code,
      denomination: item.denomination.toString(),
      costPrice: item.costPrice.toString(),
      sellPrice: item.sellPrice.toString(),
      note: item.note || "",
      image: item.image || "",
      entryDate: item.entryDate ? new Date(item.entryDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingPulsa(null);
    setFormData({
      code: "",
      denomination: "",
      costPrice: "",
      sellPrice: "",
      note: "",
      image: "",
      entryDate: new Date().toISOString().split("T")[0],
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus pulsa ini?")) return;

    try {
      const res = await fetch(`/api/pulsa?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPulsa();
        alert("Pulsa berhasil dihapus!");
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menghapus data");
      }
    } catch (error) {
      console.error("Error deleting pulsa:", error);
      alert("Gagal menghapus data");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID");
  };

  if (status === "loading") {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Pulsa</h1>
          <p className="text-gray-500 mt-1">Kelola data pulsa</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Pulsa
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari kode atau keterangan pulsa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Gambar</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kode</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Denominasi</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Harga Modal</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Harga Jual</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pulsaList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    Belum ada data pulsa
                  </td>
                </tr>
              ) : (
                pulsaList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                        {item.image ? (
                          <img src={item.image} alt={item.code} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">📱</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600">{item.code}</td>
                    <td className="px-6 py-4 font-medium">Rp {item.denomination.toLocaleString()}</td>
                    <td className="px-6 py-4">Rp {item.costPrice.toLocaleString()}</td>
                    <td className="px-6 py-4">Rp {item.sellPrice.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.note || "-"}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => setShowDetail(item)} className="text-gray-500 hover:text-gray-700">
                          👁️
                        </button>
                        <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800">
                          ✏️
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800">
                          🗑️
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

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingPulsa ? "Edit Pulsa" : "Tambah Pulsa"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Kode Pulsa *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Denominasi (Rp) *</label>
                <input
                  type="number"
                  value={formData.denomination}
                  onChange={(e) => setFormData({ ...formData, denomination: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Harga Modal *</label>
                  <input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Harga Jual *</label>
                  <input
                    type="number"
                    value={formData.sellPrice}
                    onChange={(e) => setFormData({ ...formData, sellPrice: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Keterangan / Note</label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  placeholder="REGULER, PROMO, TAGOG, dll"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Foto Pulsa</label>
                <ImageUploader
                  onImageCapture={(imageData) => setFormData({ ...formData, image: imageData })}
                  currentImage={formData.image}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-purple-600 text-white py-2 rounded-lg">
                  {editingPulsa ? "Update" : "Simpan"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 bg-gray-200 py-2 rounded-lg"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Detail Pulsa</h2>
            <div className="space-y-3">
              <div><strong>Kode:</strong> {showDetail.code}</div>
              <div><strong>Denominasi:</strong> Rp {showDetail.denomination.toLocaleString()}</div>
              <div><strong>Harga Modal:</strong> Rp {showDetail.costPrice.toLocaleString()}</div>
              <div><strong>Harga Jual:</strong> Rp {showDetail.sellPrice.toLocaleString()}</div>
              <div><strong>Note:</strong> {showDetail.note || "-"}</div>
            </div>
            <button onClick={() => setShowDetail(null)} className="mt-6 w-full bg-gray-200 py-2 rounded-lg">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}