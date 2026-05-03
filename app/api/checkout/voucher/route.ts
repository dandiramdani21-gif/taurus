// app/api/checkout/voucher/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { notifyLowStockTelegram, notifyTelegram, sendTelegramDocument } from "@/lib/notifications";
import { getValidatedSessionUser } from "@/lib/session-user";
import { buildInvoicePdfBuffer, type InvoicePdfItem } from "@/lib/invoice-pdf";
import { generateInvoiceNumber } from "@/lib/invoice-number";

const LOW_STOCK_THRESHOLD = 3;
const MAX_INVOICE_RETRIES = 5;

function formatMoney(value: number) {
  return `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
}

function isUniqueInvoiceError(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code?: string }).code !== "P2002"
  ) {
    return false;
  }
  const meta = (error as { meta?: { target?: string[] } }).meta;
  if (meta?.target) {
    return meta.target.includes("invoiceNumber");
  }
  return true;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = await getValidatedSessionUser(session);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { items, totalAmount, totalCost, profit } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items tidak boleh kosong" }, { status: 400 });
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_INVOICE_RETRIES; attempt++) {
      // Generate fresh tiap attempt, tanpa parameter category
      const invoiceNumber = generateInvoiceNumber();

      try {
        const lowStockAlertItems: Array<{ name: string; code: string; stock: number }> = [];

        const transaction = await prisma.$transaction(async (tx) => {
          const invoiceItems: InvoicePdfItem[] = [];

          // 1. Buat Transaction record
          const newTransaction = await tx.transaction.create({
            data: {
              invoiceNumber,
              type: "SALE",
              category: "PRODUK_LAIN",
              totalAmount: Number(totalAmount),
              totalCost: Number(totalCost),
              profit: Number(profit),
              userId: user.id,
              servedByName: user.name || null,
              note: "Penjualan Voucher",
            },
          });

          // 2. Buat TransactionItem untuk setiap voucher
          for (const item of items) {
            const voucher = await tx.voucher.findUnique({
              where: { id: item.productId },
              select: { name: true, code: true, stock: true },
            });

            if (!voucher) {
              throw new Error(`Voucher dengan ID ${item.productId} tidak ditemukan`);
            }

            await tx.transactionItem.create({
              data: {
                transactionId: newTransaction.id,
                status: "PAID",
                voucherId: item.productId,
                quantity: item.quantity,
                sellPrice: Number(item.sellPrice),
                costPrice: Number(item.costPrice),
              },
            });

            // 3. Kurangi stok voucher
            const updatedVoucher = await tx.voucher.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
              select: { name: true, code: true, stock: true },
            });

            if (updatedVoucher.stock <= LOW_STOCK_THRESHOLD) {
              lowStockAlertItems.push({
                name: updatedVoucher.name,
                code: updatedVoucher.code,
                stock: updatedVoucher.stock,
              });
            }

            invoiceItems.push({
              name: voucher.name,
              code: voucher.code,
              quantity: Number(item.quantity || 1),
              unitPrice: Number(item.sellPrice || 0),
              total: Number(item.sellPrice || 0) * Number(item.quantity || 1),
            });
          }

          return { transaction: newTransaction, invoiceItems };
        });

        // ─── Sukses ────────────────────────────────────────────────────────
        const finalInvoiceNumber = transaction.transaction.invoiceNumber ?? invoiceNumber;

        const invoicePdf = buildInvoicePdfBuffer({
          invoiceNumber: finalInvoiceNumber,
          invoiceDate: new Date(transaction.transaction.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          storeName: "Taurus Cellular",
          storeAddressLines: [
            "Jl. Raya Tanjungsari No.129",
            "Kec. Tanjungsari, Kabupaten Sumedang",
            "Jawa Barat, 45362",
            "0857-5902-5901",
          ],
          categoryLabel: "Voucher",
          items: transaction.invoiceItems,
          totalAmount: Number(totalAmount),
          totalCost: Number(totalCost),
          profit: Number(profit),
          notes: [`Kasir: ${user.name || "-"}`],
          footer: "Terima kasih telah berbelanja di Taurus Cellular.",
        });

        const allLowStockVouchers = await prisma.voucher.findMany({
          where: { stock: { lte: LOW_STOCK_THRESHOLD } },
          select: { name: true, code: true, stock: true },
          orderBy: { stock: "asc" },
        });

        const uniqueLowStockItems = Array.from(
          new Map(
            [...allLowStockVouchers, ...lowStockAlertItems].map((item) => [item.code, item])
          ).values()
        );

        await Promise.allSettled([
          sendTelegramDocument({
            title: "Invoice Checkout Voucher",
            message: [
              `Invoice: ${finalInvoiceNumber}`,
              `Total: ${formatMoney(Number(totalAmount))}`,
              `Item: ${items.length}`,
            ].join("\n"),
            filename: `${finalInvoiceNumber}.pdf`,
            document: invoicePdf,
          }),
          notifyTelegram({
            title: "Checkout Voucher",
            message: `Invoice: ${finalInvoiceNumber}\nTotal: Rp ${Number(totalAmount).toLocaleString("id-ID")}`,
          }),
          notifyLowStockTelegram({
            title: "Stok Menipis - Voucher",
            items: uniqueLowStockItems.map((item) => ({
              name: item.name,
              code: item.code,
              stock: item.stock,
            })),
          }),
        ]);

        return NextResponse.json({
          success: true,
          id: transaction.transaction.id,
          invoiceNumber: finalInvoiceNumber,
          message: "Checkout voucher berhasil",
        });
      } catch (err: unknown) {
        if (isUniqueInvoiceError(err)) {
          console.warn(`Invoice collision (attempt ${attempt + 1}): ${invoiceNumber}`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    console.error("Gagal generate invoice unik setelah", MAX_INVOICE_RETRIES, "percobaan", lastError);
    return NextResponse.json({ error: "Gagal membuat invoice, coba lagi" }, { status: 500 });
  } catch (error: unknown) {
    console.error("Checkout voucher error:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Salah satu voucher tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal melakukan checkout voucher" },
      { status: 500 }
    );
  }
}