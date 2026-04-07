"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface TransactionItem {
  id: string;
  quantity: number;
  sellPrice: number;
  costPrice: number;
  product?: {
    name: string;
    code: string;
    image?: string;
  };
  phone?: {
    brand: string;
    type: string;
    code: string;
    image?: string;
  };
}

interface Transaction {
  id: string;
  totalAmount: number;
  totalCost: number;
  profit: number;
  createdAt: string;
  items: TransactionItem[];
}

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notes, setNotes] = useState("Terima kasih telah berbelanja di Taurus Cellular.");
  const [paymentDetails, setPaymentDetails] = useState("Pembayaran dapat dilakukan secara tunai atau transfer bank.");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchData = async () => {
      // Await params di server component context
      const resolvedParams = await params;
      const transactionId = resolvedParams.id as string;
      
      if (transactionId) {
        await fetchTransaction(transactionId);
      }
    };
    
    fetchData();
  }, [params]);

  const fetchTransaction = async (id: string) => {
    try {
      const res = await fetch(`/api/transactions/${id}`);
      if (!res.ok) {
        throw new Error("Transaction not found");
      }
      const data = await res.json();
      setTransaction(data);
      setInvoiceNumber(data.id.slice(-8).toUpperCase());
      setInvoiceDate(new Date(data.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).toUpperCase());
    } catch (error) {
      console.error("Error fetching transaction:", error);
      setError("Transaksi tidak ditemukan");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-purple-600">Sedang memuat data...</div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="text-red-500 mb-4">{error || "Transaksi tidak ditemukan"}</div>
        <button
          onClick={() => router.push("/kasir")}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
        >
          Kembali ke Kasir
        </button>
      </div>
    );
  }

  const subtotal = transaction.totalAmount || 0;
  const total = subtotal

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Invoice Article */}
        <article className="invoice" id="invoice-print">
          <header className="header">
            <h1 className="header--invoice">
              INVOICE
              <div className="invoice--date" contentEditable={false} suppressContentEditableWarning>
                {invoiceDate}
              </div>
              <div className="invoice--number">
                INVOICE #
                <span contentEditable={false} suppressContentEditableWarning>
                  {invoiceNumber}
                </span>
              </div>
            </h1>
            <nav className="header--logo">
              <div className="header--logo-text" contentEditable={false} suppressContentEditableWarning>
                Taurus Cellular
              </div>
              <div className="logo--address" contentEditable={false} suppressContentEditableWarning>
                Jl. Raya Tanjungsari No.129
                <br />
                Kec. Tanjungsari,
                <br/>
                Kabupaten Sumedang,
                <br/>
                Jawa Barat, 45362
                <br />
                <strong>0857-5902-5901</strong>
              </div>
            </nav>
          </header>

          <section className="description">
            <h5>Invoice Notes / Details</h5>
            <p contentEditable={false} suppressContentEditableWarning>
              {notes}
            </p>
          </section>

          <section className="line-items">
            <table className="items--table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Total IDR</th>
                </tr>
              </thead>
              <tbody>
                {transaction.items && transaction.items.length > 0 ? (
                  transaction.items.map((item, idx) => {
                    const itemName = item.product?.name || `${item.phone?.brand} ${item.phone?.type}` || "-";
                    const itemCode = item.product?.code || item.phone?.code || "-";
                    const subtotalItem = (item.quantity || 0) * (item.sellPrice || 0);
                    
                    return (
                      <tr key={idx}>
                        <td>
                          {itemName}
                          <br />
                          <small style={{ fontSize: "11px", color: "#888" }}>{itemCode}</small>
                        </td>
                        <td>{item.quantity}</td>
                        <td>Rp {item.sellPrice?.toLocaleString() || 0}</td>
                        <td>Rp {subtotalItem.toLocaleString()}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center" }}>Tidak ada item</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: "bold" }}>Subtotal</td>
                  <td style={{ fontWeight: "bold" }}>Rp {subtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: "bold", fontSize: "16px" }}>TOTAL</td>
                  <td className="total-price">Rp {total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="description">
            <h5>Payment Details</h5>
            <p contentEditable={false} suppressContentEditableWarning>
              {paymentDetails}
            </p>
            <p className="footer-text" contentEditable={false} suppressContentEditableWarning>
              Jika ada pertanyaan, silakan hubungi kami di info@taurus.com
            </p>
          </section>
        </article>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handlePrint}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold transition"
          >
            🖨️ Print
          </button>
          <button
            onClick={() => router.push("/kasir")}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition"
          >
            Kembali ke Kasir
          </button>
        </div>
      </div>

<style jsx global>{`

  [contenteditable="true"]:hover {
    outline: lightblue auto 5px;
    outline: -webkit-focus-ring-color auto 5px;
  }
  @media print {
    /* Sembunyikan URL, tanggal, dan nomor halaman dari browser */
    @page {
      margin: 0;
    }
}
  .invoice {
    padding: 0;
    font-family: "Avenir", serif;
    font-weight: 100;
    width: 95%;
    max-width: 1000px;
    margin: 0 auto;
    box-sizing: border-box;
    padding: 20px;
    border-radius: 5px;
    background: #fff;
    min-height: 800px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .header {
    display: flex;
    width: 100%;
    border-bottom: 2px solid #eee;
    align-items: center;
  }

  .header--invoice {
    order: 2;
    text-align: right;
    width: 40%;
    margin: 0;
    padding: 0;
    font-size: 24px;
  }

  .invoice--date,
  .invoice--number {
    font-size: 12px;
    color: #494949;
  }

  .invoice--recipient {
    margin-top: 25px;
    margin-bottom: 4px;
    font-size: 14px;
  }

  .header--logo {
    order: 1;
    font-size: 32px;
    width: 60%;
    font-weight: 900;
  }

  .logo--address {
    font-size: 12px;
    padding: 4px;
  }

  .description {
    margin: 20px auto;
    text-align: justify;
  }

  .description h5 {
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .description p {
    font-size: 13px;
    color: #555;
    line-height: 1.5;
  }

  .items--table {
    width: 100%;
    padding: 10px;
    border-collapse: collapse;
  }

  .items--table thead {
    background: #ddd;
    color: #111;
    text-align: center;
    font-weight: 800;
  }

  .items--table thead th {
    padding: 12px 8px;
  }

  .items--table tbody {
    text-align: center;
  }

  .items--table tbody td {
    padding: 10px 8px;
    border-bottom: 1px solid #eee;
  }

  .items--table .total-price {
    padding: 8px;
    font-weight: 800;
  }

  .footer-text {
    margin-top: 20px;
    font-size: 12px;
    color: #888;
  }

  /* ✅ Perbaiki print: sembunyikan sidebar dan elemen lain yang tidak perlu */
  @media print {
    body {
      background: white;
      margin: 0;
      padding: 0;
    }
    
    /* Sembunyikan sidebar dan semua elemen di luar invoice */
    aside, 
    .sidebar,
    header:not(.header),
    nav:not(.header--logo),
    button,
    .flex.gap-3.mt-6,
    .bg-gray-100.py-8 > .max-w-4xl > .flex.gap-3 {
      display: none !important;
    }
    
    /* Sembunyikan elemen layout yang mengganggu */
    .min-h-screen {
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    
    /* Tampilkan hanya invoice */
    .invoice {
      box-shadow: none;
      margin: 0;
      padding: 20px;
      width: 100%;
      max-width: 100%;
      min-height: auto;
      position: relative;
      z-index: 9999;
      background: white;
    }
    
    /* Pastikan konten invoice terlihat */
    .invoice * {
      visibility: visible;
      color: black !important;
    }
    
    [contenteditable="true"]:hover {
      outline: none;
    }
  }
`}</style>
    </div>
  );
}