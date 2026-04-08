import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items, totalAmount, totalCost, profit, note } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items cannot be empty" }, { status: 400 });
    }

    // Validasi setiap item punya productId
    for (const item of items) {
      if (!item.productId) {
        return NextResponse.json({ error: "productId is required for each item" }, { status: 400 });
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // Buat Transaction
      const newTransaction = await tx.transaction.create({
        data: {
          type: "SALE",
          status: "ACTIVE",
          totalAmount: Number(totalAmount),
          totalCost: Number(totalCost),
          profit: Number(profit),
          note: note || "Penjualan Pulsa",
          userId: session.user.id,
        },
      });

      // Buat TransactionItem untuk setiap pulsa
      for (const item of items) {
        await tx.transactionItem.create({
          data: {
            transactionId: newTransaction.id,
            pulsaId: item.productId,        // ← ini yang paling penting
            quantity: Number(item.quantity),
            sellPrice: Number(item.sellPrice),
            costPrice: Number(item.costPrice),
          },
        });
      }

      return newTransaction;
    });

    return NextResponse.json({
      success: true,
      id: transaction.id,
      message: "Checkout pulsa berhasil",
    });

  } catch (error: any) {
    console.error("Checkout Pulsa Error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error.message || "Terjadi kesalahan saat checkout" 
    }, { status: 500 });
  }
}