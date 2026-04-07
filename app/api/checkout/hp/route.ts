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

    // Validasi stok dan siapkan data
    const transactionItems = [];
    
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
      });
    }

    // Create transaction
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
      include: {
        items: true,
      },
    });

    // Update stok HP
    for (const item of items) {
      await prisma.phone.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error checkout HP:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}