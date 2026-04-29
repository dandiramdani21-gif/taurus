/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  imei: string;
  brand: string;
  type: string;
  purchasePrice: number;
  stock: number;
  image: string | null;
}

interface CartItem {
  id: string;
  productId: string;
  imei: string;
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
  invoiceId?: string;
  totalAmount?: number;
  profit?: number;
}

export default function KasirHpPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalData>({
    isOpen: false,
    success: false,
    message: "",
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 6,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hp?page=${pagination.page}&limit=${pagination.limit}&search=${search}`);
      const data = await res.json();
      setProducts(data.phones || []);
      setPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 0 });
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("Stok habis!");
      return;
    }

    const productName = `${product.brand} ${product.type}`;

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
          imei: product.imei,
          name: productName,
          costPrice: product.purchasePrice,
          sellPrice: product.purchasePrice,
          quantity: 1,
          subtotal: product.purchasePrice,
          profit: 0,
          isEditingCost: false,
          tempCostPrice: product.purchasePrice,
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
      const res = await fetch("/api/hp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          purchasePrice: newCostPrice,
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

  const closeModal = () => {
    setCheckoutModal({ isOpen: false, success: false, message: "" });
  };

  const goToInvoice = () => {
    if (checkoutModal.invoiceId) {
      router.push(`/invoice/${checkoutModal.invoiceId}`);
    }
    closeModal();
  };

  const handleCheckout = async () => {
    if (isCheckingOut) return;

    if (cart.length === 0) {
      alert("Keranjang kosong!");
      return;
    }

    const editingItem = cart.find((item) => item.isEditingCost);
    if (editingItem) {
      alert("Simpan perubahan harga modal terlebih dahulu!");
      return;
    }

    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/checkout/hp", {
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
        // Show success modal with invoice link
        setCheckoutModal({
          isOpen: true,
          success: true,
          message: "Payment successful",
          invoiceId: data.id,
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
          invoiceId: undefined,
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
        invoiceId: undefined,
        totalAmount: undefined,
        profit: undefined,
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (status === "loading") return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex flex-col gap-5 px-6 py-8 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              Kasir Handphone
            </div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Kasir HP</h1>
            <p className="max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              Pilih handphone yang akan dijual
            </p>
          </div>

          <input
            type="text"
            placeholder="Cari brand atau type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/45 outline-none backdrop-blur-xl focus:border-white/20 focus:ring-2 focus:ring-white/20 lg:w-96"
          />
        </div>
      </section>

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* LEFT - TABEL PRODUK */}
        <div className="flex-1">

          {loading ? (
            <div className="text-center py-12">Memuat data...</div>
          ) : (
            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {products.map((product) => (
                  <article key={product.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-16 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                        {product.image ? (
                          <img src={product.image} alt={product.brand} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl text-gray-400">📱</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{product.brand}</p>
                        <p className="mt-1 text-sm font-medium text-violet-600">Rp {product.purchasePrice.toLocaleString("id-ID")}</p>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${product.stock === 0 ? "bg-red-100 text-red-700" :
                            product.stock < 5 ? "bg-orange-100 text-orange-700" :
                              "bg-green-100 text-green-700"
                          }`}>
                          TIPE {product.type}
                        </span>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${product.stock === 0 ? "bg-red-100 text-red-700" :
                            product.stock < 5 ? "bg-purple-100 text-purple-700" :
                              "bg-green-100 text-green-700"
                          }`}>
                          IMEI {product.imei}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:bg-slate-300"
                    >
                      Tambah ke Keranjang
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-6 py-3 rounded-2xl border border-white/70 bg-white/80 disabled:opacity-50 hover:bg-violet-50"
              >
                Previous
              </button>
              <span className="px-6 py-3 text-slate-600">
                Halaman {pagination.page} dari {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-6 py-3 rounded-2xl border border-white/70 bg-white/80 disabled:opacity-50 hover:bg-violet-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* RIGHT - KERANJANG */}
        <div className="lg:w-96 rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl flex flex-col h-fit sticky top-6">
          <div className="p-6 border-b border-slate-100">
            <h2 className="font-bold text-2xl text-slate-900">Keranjang</h2>
            <p className="text-slate-500 mt-1">{cart.length} item</p>
          </div>

          <div className="flex-1 max-h-[520px] overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                Keranjang kosong<br />Klik tombol &quot;Tambah&quot; di tabel
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-3xl p-4">

                  <div className="flex justify-between">
                    <div className="font-medium text-slate-900">{item.name}</div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className=" text-xs text-rose-500 hover:text-rose-700"
                    >
                      Hapus
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs text-slate-500">Harga Modal</label>
                      {item.isEditingCost ? (
                        <div className="flex gap-2 mt-1">
                          <input
                            type="number"
                            value={item.tempCostPrice}
                            onChange={(e) => updateTempCost(item.id, parseInt(e.target.value) || 0)}
                            className="flex-1 rounded-xl border border-slate-200 p-2 text-sm"
                            autoFocus
                          />
                          <button onClick={() => saveCostPrice(item.id, item.productId, item.tempCostPrice || 0)} className="px-4 rounded-xl bg-emerald-600 text-white">Save</button>
                          <button onClick={() => cancelEditCost(item.id)} className="px-4 rounded-xl bg-slate-200 text-slate-700">Batal</button>
                        </div>
                      ) : (
                        <div className="flex justify-between mt-1">
                          <span className="text-slate-900">Rp {item.costPrice.toLocaleString()}</span>
                          <button onClick={() => startEditCost(item.id, item.costPrice)} className="text-xs text-violet-600">Edit</button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-slate-500">Harga Jual</label>
                      <input
                        type="number"
                        value={item.sellPrice}
                        onChange={(e) => updateSellPrice(item.id, parseInt(e.target.value) || 0)}
                        className="w-full mt-1 rounded-xl border border-slate-200 p-2 text-sm"
                      />
                    </div>

                    <div className="flex justify-between border-t border-slate-100 pt-3 font-medium">
                      <span>Subtotal</span>
                      <span className="text-slate-900">Rp {item.subtotal.toLocaleString()}</span>
                    </div>
                  </div>


                </div>
              ))
            )}
          </div>

          <div className="rounded-b-[2rem] border-t border-slate-100 bg-slate-50/80 p-6">
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
              disabled={cart.length === 0 || isCheckingOut}
              className="w-full mt-6 rounded-2xl bg-slate-950 py-4 text-lg font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isCheckingOut ? "Memproses..." : "Bayar Sekarang"}
            </button>
          </div>
        </div>
      </div>

      {isCheckingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="rounded-3xl border border-white/20 bg-white/95 px-6 py-5 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-sm font-semibold text-slate-900">Memproses checkout...</p>
            <p className="mt-1 text-xs text-slate-500">Mohon tunggu, jangan klik dua kali.</p>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL - DENGAN 2 TOMBOL (LIHAT INVOICE & CLOSE) */}
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
                {checkoutModal.success ? 'Pembayaran Berhasil' : 'Payment Failed'}
              </h2>

              {/* Message */}
              <p className="text-gray-500 mt-3 leading-relaxed">
                {checkoutModal.success
                  ? `Terima kasih telah berbelanja di Taurus Cell.`
                  : checkoutModal.message
                }
              </p>

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

            {/* Buttons - 2 Tombol untuk Success, 1 Tombol untuk Error */}
            <div className="p-6 mt-4 space-y-3">
              {checkoutModal.success ? (
                <>
                  <button
                    onClick={goToInvoice}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition duration-200"
                  >
                    Lihat Invoice
                  </button>
                  <button
                    onClick={closeModal}
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition duration-200"
                  >
                    Close
                  </button>
                </>
              ) : (
                <button
                  onClick={closeModal}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition duration-200"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
