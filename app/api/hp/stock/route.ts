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

    const existing = await prisma.phone.findUnique({
      where: { id },
      select: { stock: true, brand: true, type: true, purchasePrice: true },
    });

    const phone = await prisma.phone.update({
      where: { id },
      data: { stock },
    });

    if (existing) {
      await logRestock({
        category: "HANDPHONE",
        productType: "PHONE",
        productId: id,
        productName: `${existing.brand} ${existing.type}`,
        quantity: Math.abs(Number(stock) - existing.stock),
        previousStock: existing.stock,
        newStock: Number(stock),
        costPrice: existing.purchasePrice,
        source: "SCAN",
        note: "Update stok handphone via scanner",
        userId: session.user.id,
      });
    }

    if (Number(stock) <= LOW_STOCK_THRESHOLD) {
      const lowStockPhones = await prisma.phone.findMany({
        where: { stock: { lte: LOW_STOCK_THRESHOLD } },
        select: { brand: true, type: true, imei: true, stock: true },
        orderBy: { stock: "asc" },
      });

      await notifyLowStockTelegram({
        title: "Stok Menipis - Handphone",
        items: lowStockPhones.map((item) => ({
          name: `${item.brand} ${item.type}`,
          code: item.imei,
          stock: item.stock,
        })),
      });
    }

    return NextResponse.json(phone);
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
