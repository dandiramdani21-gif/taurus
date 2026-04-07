import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { items, totalAmount, totalCost, profit } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Tidak ada item dalam transaksi" }, { status: 400 });
    }

    const transactionItems = [];
    
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
    }

    const transaction = await prisma.transaction.create({
      data: {
        type: "SALE",
        totalAmount,
        totalCost,
        profit,
        status: "ACTIVE",
        userId: session.user.id,
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

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error checkout accessory:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}