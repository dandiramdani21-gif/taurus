// app/api/checkout/voucher/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { notifyLowStockTelegram, notifyTelegram, sendTelegramDocument } from "@/lib/notifications";
import { getValidatedSessionUser } from "@/lib/session-user";
import { buildInvoicePdfBuffer, type InvoicePdfItem } from "@/lib/invoice-pdf";

const LOW_STOCK_THRESHOLD = 3;

function formatInvoiceNumber(transactionId: string) {
  return `INV-${transactionId.slice(-8).toUpperCase()}`;
}

function formatMoney(value: number) {
  return `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
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

    // Track low stock items within the transaction
    const lowStockAlertItems: Array<{ name: string; code: string; stock: number }> = [];

    // Gunakan Prisma Transaction agar semuanya atomic
    const transaction = await prisma.$transaction(async (tx) => {
      const invoiceItems: InvoicePdfItem[] = [];

      // 1. Buat Transaction record
      const newTransaction = await tx.transaction.create({
        data: {
          type: "SALE",
          category: "PRODUK_LAIN",
          status: "ACTIVE",
          totalAmount: Number(totalAmount),
          totalCost: Number(totalCost),
          profit: Number(profit),
          userId: user.id,
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
            voucherId: item.productId,
            quantity: item.quantity,
            sellPrice: Number(item.sellPrice),
            costPrice: Number(item.costPrice),
          },
        });

        // 3. Kurangi stok voucher
        const updatedVoucher = await tx.voucher.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
          select: { name: true, code: true, stock: true },
        });

        // Check if stock is low after update
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

      return { transaction: newTransaction, invoiceItems, lowStockAlertItems };
    });

    const invoiceNumber = formatInvoiceNumber(transaction.transaction.id);
    const invoicePdf = buildInvoicePdfBuffer({
      invoiceNumber,
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

    // Get all low stock vouchers (including those from other products)
    const allLowStockVouchers = await prisma.voucher.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { name: true, code: true, stock: true },
      orderBy: { stock: "asc" },
    });

    // Combine unique low stock items (remove duplicates)
    const uniqueLowStockItems = Array.from(
      new Map(
        [...allLowStockVouchers, ...transaction.lowStockAlertItems].map(item => 
          [item.code, item]
        )
      ).values()
    );

    await Promise.allSettled([
      sendTelegramDocument({
        title: "Invoice Checkout Voucher",
        message: [
          `Invoice: ${invoiceNumber}`,
          `Total: ${formatMoney(Number(totalAmount))}`,
          `Item: ${items.length}`,
        ].join("\n"),
        filename: `${invoiceNumber}.pdf`,
        document: invoicePdf,
      }),
      notifyTelegram({
        title: "Checkout Voucher",
        message: `Invoice: ${transaction.transaction.id}\nTotal: Rp ${Number(totalAmount).toLocaleString("id-ID")}`,
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
      message: "Checkout voucher berhasil",
    });

  } catch (error: unknown) {
    console.error("Checkout voucher error:", error);

    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Salah satu voucher tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Gagal melakukan checkout voucher" 
    }, { status: 500 });
  }
}