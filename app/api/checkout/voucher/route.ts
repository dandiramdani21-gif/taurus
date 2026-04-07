// app/api/checkout/voucher/route.ts
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

    const body = await request.json();
    const { items, totalAmount, totalCost, profit } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Items tidak boleh kosong" }, { status: 400 });
    }

    // Gunakan Prisma Transaction agar semuanya atomic
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Buat Transaction record
      const newTransaction = await tx.transaction.create({
        data: {
          type: "SALE",
          status: "ACTIVE",
          totalAmount: Number(totalAmount),
          totalCost: Number(totalCost),
          profit: Number(profit),
          userId: session.user.id,
          note: "Penjualan Voucher",
        },
      });

      // 2. Buat TransactionItem untuk setiap voucher
      for (const item of items) {
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
        await tx.voucher.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return newTransaction;
    });

    return NextResponse.json({
      success: true,
      id: transaction.id,
      message: "Checkout voucher berhasil",
    });

  } catch (error: any) {
    console.error("Checkout voucher error:", error);

    if (error.code === "P2025") {
      return NextResponse.json({ error: "Salah satu voucher tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ 
      error: error.message || "Gagal melakukan checkout voucher" 
    }, { status: 500 });
  }
}