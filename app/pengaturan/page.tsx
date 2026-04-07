"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function PengaturanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.name || !formData.email || !formData.password) {
      setError("Semua field wajib diisi");
      return;
    }

    if (formData.password.length < 4) {
      setError("Password minimal 4 karakter");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("User berhasil ditambahkan");
        setFormData({ name: "", email: "", password: "" });
        fetchUsers();
        setTimeout(() => setShowModal(false), 1500);
      } else {
        setError(data.error || "Gagal menambah user");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      setError("Terjadi kesalahan");
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (email === session?.user?.email) {
      setError("Tidak dapat menghapus akun sendiri");
      return;
    }

    if (!confirm(`Yakin ingin menghapus user ${email}?`)) return;

    try {
      const res = await fetch(`/api/users?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchUsers();
        setSuccess("User berhasil dihapus");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Gagal menghapus user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      setError("Terjadi kesalahan");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-purple-600">Sedang memuat data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan</h1>
        <p className="text-gray-500 mt-1">Kelola akun pengguna</p>
      </div>

      {/* Profile Card - Siapa yang login */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{session?.user?.name}</h2>
            <p className="text-gray-500">{session?.user?.email}</p>
            <p className="text-xs text-gray-400 mt-1">Status: Aktif</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Daftar User & Tambah User */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Daftar Pengguna</h2>
          <button
            onClick={() => {
              setShowModal(true);
              setError("");
              setSuccess("");
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah User
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-600 rounded-lg px-4 py-3 text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Tabel User */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">
                    Belum ada user
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.name}
                      {user.email === session?.user?.email && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">Anda</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        disabled={user.email === session?.user?.email}
                        className={`text-red-600 hover:text-red-800 transition ${
                          user.email === session?.user?.email ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah User */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Tambah User</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError("");
                  setSuccess("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 bg-white"
                  placeholder="Minimal 4 karakter"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError("");
                    setSuccess("");
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition"
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