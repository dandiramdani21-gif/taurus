import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { notifyLowStockTelegram, notifyTelegram, sendTelegramDocument } from "@/lib/notifications";
import { getValidatedSessionUser } from "@/lib/session-user";
import { buildInvoicePdfBuffer, type InvoicePdfItem } from "@/lib/invoice-pdf";
import { generateInvoiceNumber } from "@/lib/invoice-number";

const LOW_STOCK_THRESHOLD = 3;

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

    // Validasi stok dan siapkan data
    const transactionItems = [];
    const invoiceItems: InvoicePdfItem[] = [];
    
    for (const item of items) {
      const phone = await prisma.phone.findUnique({
        where: { id: item.productId },
      });
      
      if (!phone) {
        return NextResponse.json({ error: `HP dengan ID ${item.productId} tidak ditemukan` }, { status: 400 });
      }
      
      if (phone.stock < item.quantity) {
        return NextResponse.json({ 
          error: `Stok ${phone.brand} ${phone.type} tidak mencukupi. Tersisa: ${phone.stock}` 
        }, { status: 400 });
      }
      
      transactionItems.push({
        phoneId: item.productId,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
        status: item.status
      });

      invoiceItems.push({
        name: `${phone.brand} ${phone.type}`,
        code: phone.imei,
        detail: phone.color ? `Warna: ${phone.color}` : null,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.sellPrice || 0),
        total: Number(item.sellPrice || 0) * Number(item.quantity || 1),
      });

    }

    const persistedInvoiceNumber = generateInvoiceNumber();

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        invoiceNumber: persistedInvoiceNumber,
        type: "SALE",
        category: "HANDPHONE",
        totalAmount,
        totalCost,
        profit,
        userId: user.id,
        servedByName: user.name || null,
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: true,
      },
    });

    // Update stok HP
    for (const item of items) {
      await prisma.phone.update({
        where: { id: item.productId },
        data: {
          stock: { decrement: item.quantity },
          isHidden: true,
        },
      });
    }

    const invoiceNumber = transaction.invoiceNumber || persistedInvoiceNumber;
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
      categoryLabel: "Handphone",
      items: invoiceItems,
      totalAmount: Number(totalAmount),
      totalCost: Number(totalCost),
      profit: Number(profit),
      notes: [`Kasir: ${user.name || "-"}`],
      footer: "Terima kasih telah berbelanja di Taurus Cellular.",
    });

    const lowStockPhones = await prisma.phone.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { brand: true, type: true, imei: true, stock: true },
      orderBy: { stock: "asc" },
    });

    await Promise.allSettled([
      sendTelegramDocument({
        title: "Invoice Checkout Handphone",
        message: [
          `Invoice: ${invoiceNumber}`,
          `Total: ${formatMoney(Number(totalAmount))}`,
          `Item: ${items.length}`,
        ].join("\n"),
        filename: `${invoiceNumber}.pdf`,
        document: invoicePdf,
      }),
      notifyTelegram({
      title: "Checkout Handphone",
      message: `Invoice: ${invoiceNumber}\nTotal: Rp ${Number(totalAmount).toLocaleString("id-ID")}\nItem: ${items.length}`,
      }),
      notifyLowStockTelegram({
        title: "Stok Menipis - Handphone",
        items: lowStockPhones.map((phone) => ({
          name: `${phone.brand} ${phone.type}`,
          code: phone.imei,
          stock: phone.stock,
        })),
      }),
    ]);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error checkout HP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
