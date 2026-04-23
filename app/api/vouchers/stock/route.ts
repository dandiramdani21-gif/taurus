// app/api/vouchers/stock/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { logRestock } from "@/lib/restock";
import { notifyLowStockTelegram } from "@/lib/notifications";

const LOW_STOCK_THRESHOLD = 3;

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, stock } = body;

    const existing = await prisma.voucher.findUnique({
      where: { id },
      select: { stock: true, name: true, costPrice: true },
    });

    if (!id || stock === undefined) {
      return NextResponse.json({ error: "ID dan stok diperlukan" }, { status: 400 });
    }

    const voucher = await prisma.voucher.update({
      where: { id },
      data: { stock: parseInt(stock) },
    });

    if (existing) {
      await logRestock({
        category: "PRODUK_LAIN",
        productType: "VOUCHER",
        productId: id,
        productName: existing.name,
        quantity: Math.abs(parseInt(stock) - existing.stock),
        previousStock: existing.stock,
        newStock: parseInt(stock),
        costPrice: existing.costPrice,
        source: "SCAN",
        note: "Update stok voucher via scanner",
        userId: session.user.id,
      });
    }

    if (parseInt(stock) <= LOW_STOCK_THRESHOLD) {
      const lowStockVouchers = await prisma.voucher.findMany({
        where: { stock: { lte: LOW_STOCK_THRESHOLD } },
        select: { name: true, code: true, stock: true },
        orderBy: { stock: "asc" },
      });

      await notifyLowStockTelegram({
        title: "Stok Menipis - Voucher",
        items: lowStockVouchers.map((item) => ({
          name: item.name,
          code: item.code,
          stock: item.stock,
        })),
      });
    }

    return NextResponse.json(voucher);
  } catch (error: unknown) {
    console.error("Error updating voucher stock:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
