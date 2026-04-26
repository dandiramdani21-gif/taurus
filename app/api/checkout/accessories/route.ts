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
      return NextResponse.json({ error: "Tidak ada item dalam transaksi" }, { status: 400 });
    }

    const transactionItems = [];
    const invoiceItems: InvoicePdfItem[] = [];
    
    for (const item of items) {
      const accessory = await prisma.accessory.findUnique({
        where: { id: item.productId },
      });
      
      if (!accessory) {
        return NextResponse.json({ error: `Aksesoris tidak ditemukan` }, { status: 400 });
      }
      
      if (accessory.stock < item.quantity) {
        return NextResponse.json({ 
          error: `Stok ${accessory.name} tidak mencukupi. Tersisa: ${accessory.stock}` 
        }, { status: 400 });
      }
      
      transactionItems.push({
        accessoryId: item.productId,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
      });

      invoiceItems.push({
        name: accessory.name,
        code: accessory.code,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.sellPrice || 0),
        total: Number(item.sellPrice || 0) * Number(item.quantity || 1),
      });

    }

    const transaction = await prisma.transaction.create({
      data: {
        type: "SALE",
        category: "PRODUK_LAIN",
        totalAmount,
        totalCost,
        profit,
        status: "PAID",
        userId: user.id,
        servedByName: user.name || null,
        items: {
          create: transactionItems,
        },
      },
    });

    for (const item of items) {
      await prisma.accessory.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const invoiceNumber = formatInvoiceNumber(transaction.id);
    const invoicePdf = buildInvoicePdfBuffer({
      invoiceNumber,
      invoiceDate: new Date(transaction.createdAt).toLocaleDateString("id-ID", {
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
      categoryLabel: "Aksesoris",
      items: invoiceItems,
      totalAmount: Number(totalAmount),
      totalCost: Number(totalCost),
      profit: Number(profit),
      notes: [`Kasir: ${user.name || "-"}`],
      footer: "Terima kasih telah berbelanja di Taurus Cellular.",
    });

    const lowStockAccessories = await prisma.accessory.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { name: true, code: true, stock: true },
      orderBy: { stock: "asc" },
    });

    await Promise.allSettled([
      sendTelegramDocument({
        title: "Invoice Checkout Aksesoris",
        message: [
          `Invoice: ${invoiceNumber}`,
          `Total: ${formatMoney(Number(totalAmount))}`,
          `Item: ${items.length}`,
        ].join("\n"),
        filename: `${invoiceNumber}.pdf`,
        document: invoicePdf,
      }),
      notifyTelegram({
      title: "Checkout Produk Lain",
      message: `Kategori: Aksesoris\nInvoice: ${transaction.id}\nTotal: Rp ${Number(totalAmount).toLocaleString("id-ID")}`,
      }),
      notifyLowStockTelegram({
        title: "Stok Menipis - Aksesoris",
        items: lowStockAccessories.map((item) => ({
          name: item.name,
          code: item.code,
          stock: item.stock,
        })),
      }),
    ]);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error checkout accessory:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
