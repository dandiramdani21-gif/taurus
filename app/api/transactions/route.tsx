import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Debug: cek session
    console.log("Session:", session);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized - No session" }, { status: 401 });
    }
    
    if (!session.user || !session.user.id) {
      console.error("Session user ID missing:", session);
      return NextResponse.json({ error: "Unauthorized - User ID missing" }, { status: 401 });
    }

    const body = await request.json();
    const { type, items, totalAmount, totalCost, profit } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Tidak ada item dalam transaksi" }, { status: 400 });
    }

    // Siapkan data untuk transaction items
    const transactionItems = [];
    
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      
      const phone = await prisma.phone.findUnique({
        where: { id: item.productId },
      });

      if (!product && !phone) {
        return NextResponse.json({ 
          error: `Produk dengan ID ${item.productId} tidak ditemukan` 
        }, { status: 400 });
      }

      if (product && product.stock < item.quantity) {
        return NextResponse.json({ 
          error: `Stok ${product.name} tidak mencukupi` 
        }, { status: 400 });
      }
      
      if (phone && phone.stock < item.quantity) {
        return NextResponse.json({ 
          error: `Stok ${phone.brand} ${phone.type} tidak mencukupi` 
        }, { status: 400 });
      }

      transactionItems.push({
        ...(product ? { productId: item.productId } : {}),
        ...(phone ? { phoneId: item.productId } : {}),
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
      });
    }

    // Create transaction with valid userId
    const transaction = await prisma.transaction.create({
      data: {
        type,
        totalAmount,
        totalCost,
        profit,
        status: "ACTIVE",
        userId: session.user.id, // Pastikan ini ada
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: true,
      },
    });

    // Update stock
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      
      if (product) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      
      const phone = await prisma.phone.findUnique({
        where: { id: item.productId },
      });
      
      if (phone) {
        await prisma.phone.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}