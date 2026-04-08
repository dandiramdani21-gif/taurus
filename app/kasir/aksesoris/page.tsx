"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Accessory {
  id: string;
  code: string;
  name: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  image: string | null;
}

interface CartItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  costPrice: number;
  sellPrice: number;
  quantity: number;
  subtotal: number;
  profit: number;
  isEditingCost?: boolean;
  tempCostPrice?: number;
}

interface CheckoutModalData {
  isOpen: boolean;
  success: boolean;
  message: string;
  totalAmount?: number;
  profit?: number;
}

export default function KasirAksesorisPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState<Accessory[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalData>({
    isOpen: false,
    success: false,
    message: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 0,
  });
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetchProducts();
  }, [pagination.page, search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accessories?page=${pagination.page}&limit=${pagination.limit}&search=${search}`);
      const data = await res.json();
      setProducts(data.accessories || []);
      setPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 0 });
    } catch (error) {
      console.error("Error fetching accessories:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Accessory) => {
    if (product.stock <= 0) {
      alert("Stok habis!");
      return;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === product.id);

      if (existingItem) {
        if (existingItem.quantity + 1 > product.stock) {
          alert(`Stok tidak mencukupi! Tersisa ${product.stock}`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.sellPrice,
                profit: (item.sellPrice - item.costPrice) * (item.quantity + 1),
              }
            : item
        );
      }

      return [
        ...prevCart,
        {
          id: Date.now().toString(),
          productId: product.id,
          code: product.code,
          name: product.name,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          quantity: 1,
          subtotal: product.sellPrice,
          profit: product.sellPrice - product.costPrice,
          isEditingCost: false,
          tempCostPrice: product.costPrice,
        },
      ];
    });
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(id);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: newQuantity,
              subtotal: newQuantity * item.sellPrice,
              profit: (item.sellPrice - item.costPrice) * newQuantity,
            }
          : item
      )
    );
  };

  const updateSellPrice = (id: string, newPrice: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id
          ? {
              ...item,
              sellPrice: newPrice,
              subtotal: item.quantity * newPrice,
              profit: (newPrice - item.costPrice) * item.quantity,
            }
          : item
      )
    );
  };

  const startEditCost = (id: string, currentCost: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id
          ? { ...item, isEditingCost: true, tempCostPrice: currentCost }
          : item
      )
    );
  };

  const cancelEditCost = (id: string) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id
          ? { ...item, isEditingCost: false, tempCostPrice: item.costPrice }
          : item
      )
    );
  };

  const updateTempCost = (id: string, newValue: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id ? { ...item, tempCostPrice: newValue } : item
      )
    );
  };

  const saveCostPrice = async (id: string, productId: string, newCostPrice: number) => {
    if (newCostPrice < 0) {
      alert("Harga modal tidak boleh minus!");
      return;
    }

    setUpdating(id);
    try {
      const res = await fetch("/api/accessories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          costPrice: newCostPrice,
        }),
      });

      if (res.ok) {
        setCart((prevCart) =>
          prevCart.map((item) =>
            item.id === id
              ? {
                  ...item,
                  costPrice: newCostPrice,
                  tempCostPrice: newCostPrice,
                  isEditingCost: false,
                  profit: (item.sellPrice - newCostPrice) * item.quantity,
                }
              : item
          )
        );
        fetchProducts();
        alert("Harga modal berhasil diupdate!");
      } else {
        alert("Gagal update harga modal");
        cancelEditCost(id);
      }
    } catch (error) {
      console.error("Error updating cost price:", error);
      alert("Gagal update harga modal");
      cancelEditCost(id);
    } finally {
      setUpdating(null);
    }
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const calculateTotal = () => cart.reduce((sum, item) => sum + item.subtotal, 0);
  const calculateTotalProfit = () => cart.reduce((sum, item) => sum + item.profit, 0);
  const calculateTotalCost = () => cart.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("Keranjang kosong!");
      return;
    }

    const editingItem = cart.find((item) => item.isEditingCost);
    if (editingItem) {
      alert("Simpan perubahan harga modal terlebih dahulu!");
      return;
    }

    try {
      const res = await fetch("/api/checkout/accessories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            sellPrice: item.sellPrice,
            costPrice: item.costPrice,
          })),
          totalAmount: calculateTotal(),
          totalCost: calculateTotalCost(),
          profit: calculateTotalProfit(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Show success modal
        setCheckoutModal({
          isOpen: true,
          success: true,
          message: "Payment successful",
          totalAmount: calculateTotal(),
          profit: calculateTotalProfit(),
        });
        setCart([]);
        fetchProducts();
      } else {
        // Show error modal
        setCheckoutModal({
          isOpen: true,
          success: false,
          message: data.error || "Payment failed",
          totalAmount: undefined,
          profit: undefined,
        });
      }
    } catch (error) {
      console.error("Error checkout:", error);
      setCheckoutModal({
        isOpen: true,
        success: false,
        message: "Network error. Please try again.",
        totalAmount: undefined,
        profit: undefined,
      });
    }
  };

  const closeModal = () => {
    setCheckoutModal({ isOpen: false, success: false, message: "" });
  };

  if (status === "loading") return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* LEFT - TABEL PRODUK */}
      <div className="flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Kasir Aksesoris</h1>
          <input
            type="text"
            placeholder="Cari nama atau kode aksesoris..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 px-5 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">Memuat data...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-4 text-left w-20">Gambar</th>
                    <th className="px-4 py-4 text-left">Kode</th>
                    <th className="px-4 py-4 text-left">Nama Aksesoris</th>
                    <th className="px-4 py-4 text-right">Harga Jual</th>
                    <th className="px-4 py-4 text-center">Stok</th>
                    <th className="px-4 py-4 text-center w-32">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl text-gray-400">🛠️</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-gray-600">{product.code}</td>
                      <td className="px-4 py-4 font-medium">{product.name}</td>
                      <td className="px-4 py-4 text-right font-semibold text-purple-600">
                        Rp {product.sellPrice.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          product.stock === 0 ? "bg-red-100 text-red-700" :
                          product.stock < 5 ? "bg-orange-100 text-orange-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => addToCart(product)}
                          disabled={product.stock === 0}
                          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap"
                        >
                          Tambah
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-6 py-3 border border-gray-300 rounded-2xl disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-6 py-3 text-gray-600">
              Halaman {pagination.page} dari {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-6 py-3 border border-gray-300 rounded-2xl disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* RIGHT - KERANJANG */}
      <div className="lg:w-96 bg-white rounded-3xl shadow-xl flex flex-col h-fit sticky top-6">
        <div className="p-6 border-b">
          <h2 className="font-bold text-2xl">Keranjang</h2>
          <p className="text-gray-500 mt-1">{cart.length} item</p>
        </div>

        <div className="flex-1 max-h-[520px] overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              Keranjang kosong<br />Klik tombol "Tambah" di tabel
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-2xl p-4">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-500">{item.code}</div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 border rounded-xl">-</button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 border rounded-xl">+</button>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Harga Modal</label>
                    {item.isEditingCost ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="number"
                          value={item.tempCostPrice}
                          onChange={(e) => updateTempCost(item.id, parseInt(e.target.value) || 0)}
                          className="flex-1 p-2 border rounded-xl text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => saveCostPrice(item.id, item.productId, item.tempCostPrice || 0)}
                          disabled={updating === item.id}
                          className="px-4 bg-green-600 text-white rounded-xl"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => cancelEditCost(item.id)}
                          className="px-4 bg-gray-200 rounded-xl"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between mt-1">
                        <span>Rp {item.costPrice.toLocaleString()}</span>
                        <button onClick={() => startEditCost(item.id, item.costPrice)} className="text-blue-600 text-xs">Edit</button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Harga Jual</label>
                    <input
                      type="number"
                      value={item.sellPrice}
                      onChange={(e) => updateSellPrice(item.id, parseInt(e.target.value) || 0)}
                      className="w-full mt-1 p-2 border rounded-xl text-sm"
                    />
                  </div>

                  <div className="flex justify-between font-medium pt-3 border-t">
                    <span>Subtotal</span>
                    <span>Rp {item.subtotal.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-red-500 text-xs mt-4 hover:text-red-700"
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 rounded-b-3xl">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Modal</span>
              <span>Rp {calculateTotalCost().toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total Penjualan</span>
              <span className="font-semibold">Rp {calculateTotal().toLocaleString()}</span>
            </div>
            <div className={`flex justify-between font-bold text-lg ${calculateTotalProfit() >= 0 ? "text-green-600" : "text-red-600"}`}>
              <span>Keuntungan</span>
              <span>Rp {calculateTotalProfit().toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full mt-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-4 rounded-2xl font-semibold text-lg transition"
          >
            Bayar Sekarang
          </button>
        </div>
      </div>

      {/* CHECKOUT MODAL - SEDERHANA DENGAN TOMBOL CLOSE */}
      {checkoutModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full mx-4 overflow-hidden shadow-2xl transform transition-all">
            {/* Success Icon / Error Icon */}
            <div className="pt-8 pb-4 flex justify-center">
              {checkoutModal.success ? (
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
            </div>

            {/* Title */}
            <div className="text-center px-6">
              <h2 className={`text-2xl font-bold ${checkoutModal.success ? 'text-green-600' : 'text-red-600'}`}>
                {checkoutModal.success ? 'Payment Successful!' : 'Payment Failed'}
              </h2>
              

              {/* Transaction Details (only for success) */}
              {checkoutModal.success && checkoutModal.totalAmount && (
                <div className="mt-6 p-4 bg-gray-50 rounded-2xl">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Total Amount</span>
                    <span className="font-semibold">Rp {checkoutModal.totalAmount.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Profit</span>
                    <span className="font-semibold text-green-600">+Rp {checkoutModal.profit?.toLocaleString("id-ID")}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Button Close Saja */}
            <div className="p-6 mt-4">
              <button
                onClick={closeModal}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}