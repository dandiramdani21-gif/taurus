// app/invoice/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface TransactionItem {
  id: string;
  quantity: number;
  sellPrice: number;
  costPrice: number;

  phone?: { brand: string; type: string; code: string; image?: string };
  accessory?: { name: string; code: string; image?: string };
  voucher?: { name: string; code: string; image?: string };
  pulsa?: { denomination: number; code: string; note?: string; image?: string };
}

interface Transaction {
  id: string;
  totalAmount: number;
  totalCost: number;
  profit: number;
  createdAt: string;
  note?: string;
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
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    const id = params.id as string;
    if (id) fetchTransaction(id);
  }, [params.id]);

  const fetchTransaction = async (id: string) => {
    try {
      const res = await fetch(`/api/transactions/${id}`);
      if (!res.ok) throw new Error("Transaksi tidak ditemukan");

      const data = await res.json();
      setTransaction(data);

      setInvoiceNumber(`INV-${data.id.slice(-8).toUpperCase()}`);
      setInvoiceDate(
        new Date(data.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).toUpperCase()
      );
    } catch (err: any) {
      setError(err.message || "Gagal memuat invoice");
    } finally {
      setLoading(false);
    }
  };

  const getItemName = (item: TransactionItem) => {
    if (item.phone) return `${item.phone.brand} ${item.phone.type}`;
    if (item.accessory) return item.accessory.name;
    if (item.voucher) return item.voucher.name;
    if (item.pulsa) return `${item.pulsa.denomination.toLocaleString()} - ${item.pulsa.note || "Pulsa"}`;
    return "Item Tidak Dikenal";
  };

  const getItemCode = (item: TransactionItem) => {
    if (item.phone) return item.phone.code;
    if (item.accessory) return item.accessory.code;
    if (item.voucher) return item.voucher.code;
    if (item.pulsa) return item.pulsa.code;
    return "-";
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="text-center py-20">Memuat invoice...</div>;
  if (error || !transaction) {
    return (
      <div className="text-center py-20 text-red-500">
        {error || "Transaksi tidak ditemukan"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <article className="invoice" id="invoice-print">
          <header className="header">
            <h1 className="header--invoice">
              INVOICE
              <div className="invoice--date">{invoiceDate}</div>
              <div className="invoice--number">
                INVOICE # <span>{invoiceNumber}</span>
              </div>
            </h1>
            <nav className="header--logo">
              <div className="header--logo-text">Taurus Cellular</div>
              <div className="logo--address">
                Jl. Raya Tanjungsari No.129
                <br />
                Kec. Tanjungsari, Kabupaten Sumedang
                <br />
                Jawa Barat, 45362
                <br />
                <strong>0857-5902-5901</strong>
              </div>
            </nav>
          </header>

          <section className="description">
            <h5>Invoice Notes / Details</h5>
            <p>{notes}</p>
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
                {transaction.items.map((item, idx) => {
                  const itemName = getItemName(item);
                  const itemCode = getItemCode(item);
                  const subtotal = item.quantity * item.sellPrice;

                  return (
                    <tr key={idx}>
                      <td>
                        {itemName}
                        <br />
                        <small>{itemCode}</small>
                      </td>
                      <td>{item.quantity}</td>
                      <td>Rp {item.sellPrice.toLocaleString()}</td>
                      <td>Rp {subtotal.toLocaleString()}</td>
                    </tr>
                  );
                })}

                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: "bold" }}>
                    Subtotal
                  </td>
                  <td style={{ fontWeight: "bold" }}>
                    Rp {transaction.totalAmount.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: "bold", fontSize: "16px" }}>
                    TOTAL
                  </td>
                  <td className="total-price">
                    Rp {transaction.totalAmount.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="description">
            <h5>Payment Details</h5>
            <p>{paymentDetails}</p>
            <p className="footer-text">
              Jika ada pertanyaan, silakan hubungi kami di 0857-5902-5901
            </p>
          </section>
        </article>

        {/* Buttons */}
        <div className="flex gap-3 mt-6 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold transition"
          >
            🖨️ Print
          </button>
          <button
            onClick={() => router.push("/bukti")}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition"
          >
            Kembali ke Daftar Invoice
          </button>
        </div>
      </div>

      {/* Style Lama Kamu */}
      <style jsx global>{`
        [contenteditable="true"]:hover {
          outline: lightblue auto 5px;
          outline: -webkit-focus-ring-color auto 5px;
        }

        @media print {
          @page { margin: 0; }
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

        .invoice--date, .invoice--number {
          font-size: 12px;
          color: #494949;
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

        @media print {
          body { background: white; margin: 0; padding: 0; }
          aside, .sidebar, header:not(.header), button, .flex.gap-3.mt-6 {
            display: none !important;
          }
          .invoice {
            box-shadow: none;
            margin: 0;
            padding: 20px;
            width: 100%;
            max-width: 100%;
            position: relative;
            z-index: 9999;
          }
          .invoice * { visibility: visible; color: black !important; }
        }
      `}</style>
    </div>
  );
}