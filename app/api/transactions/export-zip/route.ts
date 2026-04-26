import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { buildInvoicePdfBuffer, type InvoicePdfItem } from "@/lib/invoice-pdf";
import { ProductCategory, TransactionType } from "@/generated/client";
import type { Prisma } from "@/generated/client";

function categoryLabel(category: ProductCategory) {
  if (category === "HANDPHONE") return "Handphone";
  if (category === "PRODUK_LAIN") return "Produk Lain";
  return "Pulsa";
}

type ExportItem = {
  quantity: number;
  sellPrice: number;
  pulsaDescription?: string | null;
  pulsaDestinationNumber?: string | null;
  pulsaBalance?: number | null;
  phone?: { brand: string; type: string; imei: string; color?: string | null } | null;
  accessory?: { name: string; code: string } | null;
  voucher?: { name: string; code: string } | null;
};

function itemToPdfItem(item: ExportItem): InvoicePdfItem {
  if (item.phone) {
    return {
      name: `${item.phone.brand} ${item.phone.type}`,
      code: item.phone.imei,
      detail: item.phone.color ? `Warna: ${item.phone.color}` : null,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.sellPrice || 0),
      total: Number(item.sellPrice || 0) * Number(item.quantity || 1),
    };
  }
  if (item.accessory) {
    return {
      name: item.accessory.name,
      code: item.accessory.code,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.sellPrice || 0),
      total: Number(item.sellPrice || 0) * Number(item.quantity || 1),
    };
  }
  if (item.voucher) {
    return {
      name: item.voucher.name,
      code: item.voucher.code,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.sellPrice || 0),
      total: Number(item.sellPrice || 0) * Number(item.quantity || 1),
    };
  }
  return {
    name: item.pulsaDescription || "Pulsa",
    code: item.pulsaDestinationNumber || "-",
    detail: item.pulsaBalance !== null && item.pulsaBalance !== undefined ? `Sisa saldo: Rp ${Number(item.pulsaBalance).toLocaleString("id-ID")}` : null,
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.sellPrice || 0),
    total: Number(item.sellPrice || 0) * Number(item.quantity || 1),
  };
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const type = (searchParams.get("type") || "SALE") as TransactionType;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const deleted = searchParams.get("deleted") === "true";

    const where: Prisma.TransactionWhereInput = { deleted };
    if (type) where.type = type;
    if (category && ["HANDPHONE", "PRODUK_LAIN", "PULSA"].includes(category)) where.category = category as ProductCategory;
    if (search.trim()) {
      where.OR = [
        { id: { contains: search.trim(), mode: "insensitive" } },
        { invoiceNumber: { contains: search.trim(), mode: "insensitive" } },
        { note: { contains: search.trim(), mode: "insensitive" } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        items: {
          include: {
            phone: true,
            accessory: true,
            voucher: true,
            pulsa: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    if (!transactions.length) {
      return NextResponse.json({ error: "Tidak ada transaksi untuk diexport" }, { status: 400 });
    }

    const zip = new JSZip();

    for (const transaction of transactions) {
      const invoiceNumber = transaction.invoiceNumber || `INV-${transaction.id.slice(-8).toUpperCase()}`;
      const pdf = buildInvoicePdfBuffer({
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
        categoryLabel: categoryLabel(transaction.category),
        items: transaction.items.map(itemToPdfItem),
        totalAmount: Number(transaction.totalAmount || 0),
        totalCost: Number(transaction.totalCost || 0),
        profit: Number(transaction.profit || 0),
        notes: [`Kasir: ${transaction.servedByName || "-"}`],
        footer: "Terima kasih telah berbelanja di Taurus Cellular.",
      });
      zip.file(`${invoiceNumber}.pdf`, pdf);
    }

const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
return new NextResponse(Buffer.from(zipBuffer), {
  status: 200,
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.zip"`,
  },
});
  } catch (error) {
    console.error("Error export zip:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
