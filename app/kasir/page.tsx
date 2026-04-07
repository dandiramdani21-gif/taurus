"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
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
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function KasirPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);

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
    fetchProducts();
  }, [pagination.page, debouncedSearch, selectedCategory]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/kasir/products?page=${pagination.page}&limit=${pagination.limit}&search=${debouncedSearch}&category=${selectedCategory}`
      );
      const data = await res.json();
      setProducts(data.products || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("Stok habis!");
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      
      if (existingItem) {
        if (existingItem.quantity + 1 > product.stock) {
          alert(`Stok tidak mencukupi! Tersisa ${product.stock}`);
          return prevCart;
        }
        return prevCart.map(item =>
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
          sellPrice: 0,
          quantity: 1,
          subtotal: product.sellPrice || product.costPrice,
          profit: (product.sellPrice || product.costPrice) - product.costPrice,
        },
      ];
    });
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    const item = cart.find(i => i.id === id);
    const product = products.find(p => p.id === item?.productId);
    
    if (newQuantity < 1) {
      removeFromCart(id);
      return;
    }
    
    if (product && newQuantity > product.stock) {
      alert(`Stok tidak mencukupi! Tersisa ${product.stock}`);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
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
    setCart(prevCart =>
      prevCart.map(item =>
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

  const removeFromCart = (id: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const calculateTotalProfit = () => {
    return cart.reduce((sum, item) => sum + item.profit, 0);
  };

  const calculateTotalCost = () => {
    return cart.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  };

const handleCheckout = async () => {
  if (cart.length === 0) {
    alert("Keranjang kosong!");
    return;
  }

  try {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "SALE",
        items: cart.map(item => ({
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

    if (res.ok) {
      const transaction = await res.json();
      // Redirect ke halaman invoice
      router.push(`/invoice/${transaction.id}`);
      setCart([]);
      fetchProducts();
    } else {
      const error = await res.json();
      alert(error.error || "Gagal checkout");
    }
  } catch (error) {
    console.error("Error checkout:", error);
    alert("Gagal melakukan checkout");
  }
};

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-purple-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-2rem)]">
      <div className="flex gap-6 h-full">
        {/* Left Side - Products */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Kasir</h1>
            <p className="text-gray-500 mt-1">Pilih produk untuk dijual</p>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="all">Semua Kategori</option>
              <option value="ACCESSORY">Aksesoris</option>
              <option value="VOUCHER">Voucher</option>
              <option value="PULSA">Pulsa</option>
              <option value="PHONE">HP</option>
            </select>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-purple-600">Loading...</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                      Tidak ada produk ditemukan
                    </div>
                  ) : (
                    products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        disabled={product.stock === 0}
                        className={`p-3 rounded-xl border text-left transition ${
                          product.stock === 0
                            ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
                            : "bg-white border-gray-200 hover:border-purple-300 hover:shadow-md cursor-pointer"
                        }`}
                      >
                        {/* Product Image */}
                        <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://placehold.co/200x200?text=No+Image";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Product Info */}
                        <div className="font-medium text-gray-800 truncate text-sm">{product.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{product.code}</div>
                        <div className="text-base font-semibold text-purple-600 mt-2">
                          Rp {(product.sellPrice || product.costPrice)?.toLocaleString()}
                        </div>
                        
                        <div className={`text-xs mt-1 ${product.stock < 3 ? "text-orange-500" : "text-gray-400"}`}>
                          Stok: {product.stock}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-3 py-1 rounded border disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-1 rounded border disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Side - Cart */}
        <div className="w-96 bg-white rounded-xl shadow-lg flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Keranjang Belanja</h2>
            <p className="text-sm text-gray-500">{cart.length} item</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p>Belum ada item</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.code}</div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="w-10 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                    
                    <div>
                      <label className="text-xs text-gray-500">Harga Jual</label>
                      <input
                        type="number"
                        onChange={(e) => updateSellPrice(item.id, parseInt(e.target.value) || 0)}
                        className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Modal:</span>
                      <span>Rp {item.costPrice.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal:</span>
                      <span className="font-semibold">Rp {item.subtotal.toLocaleString()}</span>
                    </div>
                    <div className={`flex justify-between text-sm ${item.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      <span>Keuntungan:</span>
                      <span>Rp {item.profit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary */}
          <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Modal:</span>
              <span>Rp {calculateTotalCost().toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Penjualan:</span>
              <span className="font-semibold">Rp {calculateTotal().toLocaleString()}</span>
            </div>
            <div className={`flex justify-between text-lg font-bold pt-2 border-t border-gray-200 ${calculateTotalProfit() >= 0 ? "text-green-600" : "text-red-600"}`}>
              <span>Keuntungan:</span>
              <span>Rp {calculateTotalProfit().toLocaleString()}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Bayar
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Page */}
      {showInvoice && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">INVOICE</h1>
              <button
                onClick={() => setShowInvoice(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              {/* Header */}
              <div className="text-center border-b border-gray-200 pb-4">
                <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                {/* <h2 className="text-xl font-bold text-gray-800">Taurus Cellular</h2>
                <p className="text-sm text-gray-500 mt-1">Jl. Contoh No. 123, Kota</p>
                <p className="text-sm text-gray-500">Telp: 0812-3456-7890</p> */}
              </div>

              {/* Info */}
              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-gray-500">No. Invoice</p>
                  <p className="font-medium">{invoiceData?.id?.slice(-8) || "INV-001"}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500">Tanggal</p>
                  <p className="font-medium">{new Date().toLocaleString("id-ID")}</p>
                </div>
              </div>

              {/* Items */}
              <table className="w-full text-sm">
                <thead className="border-t border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2">Item</th>
                    <th className="text-center py-2">Qty</th>
                    <th className="text-right py-2">Harga</th>
                    <th className="text-right py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData?.items.map((item: CartItem, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-400">{item.code}</div>
                       </td>
                      <td className="text-center py-2">{item.quantity}</td>
                      <td className="text-right py-2">Rp {item.sellPrice.toLocaleString()}</td>
                      <td className="text-right py-2">Rp {item.subtotal.toLocaleString()}</td>
                     </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <div className="border-t border-gray-200 pt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>Rp {calculateTotal().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>Rp {Math.floor(calculateTotal() * 1.1).toLocaleString()}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-200">
                <p>Terima kasih telah berbelanja!</p>
                <p className="mt-1">*** Simpan struk ini sebagai bukti pembelian ***</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition"
              >
                Print
              </button>
              <button
                onClick={() => setShowInvoice(false)}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}