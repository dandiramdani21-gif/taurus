// app/api/vouchers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.voucher.count({ where }),
    ]);

    return NextResponse.json({
      vouchers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Create Voucher
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, costPrice, sellPrice, stock, image, entryDate, expiredAt } = body;

    const existing = await prisma.voucher.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "Kode voucher sudah terdaftar" }, { status: 400 });
    }

    const voucher = await prisma.voucher.create({
      data: {
        code,
        name,
        costPrice: parseInt(costPrice),
        sellPrice: parseInt(sellPrice),
        stock: parseInt(stock) || 0,
        image: image || null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        expiredAt: expiredAt ? new Date(expiredAt) : null,
      },
    });

    return NextResponse.json(voucher, { status: 201 });
  } catch (error) {
    console.error("Error creating voucher:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT - Update Voucher
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, code, name, costPrice, sellPrice, stock, image, entryDate, expiredAt } = body;

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    // Cek unique code jika diubah
    if (code) {
      const existing = await prisma.voucher.findUnique({ where: { code } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Kode voucher sudah terdaftar" }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (costPrice !== undefined) updateData.costPrice = parseInt(costPrice);
    if (sellPrice !== undefined) updateData.sellPrice = parseInt(sellPrice);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (image !== undefined) updateData.image = image || null;
    if (entryDate !== undefined) updateData.entryDate = entryDate ? new Date(entryDate) : undefined;
    if (expiredAt !== undefined) updateData.expiredAt = expiredAt ? new Date(expiredAt) : null;

    const voucher = await prisma.voucher.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(voucher);
  } catch (error: any) {
    console.error("Error updating voucher:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const used = await prisma.transactionItem.count({ where: { voucherId: id } });
    if (used > 0) {
      return NextResponse.json({ 
        error: "Tidak bisa dihapus karena sudah digunakan di transaksi" 
      }, { status: 400 });
    }

    await prisma.voucher.delete({ where: { id } });

    return NextResponse.json({ message: "Voucher berhasil dihapus" });
  } catch (error: any) {
    console.error("Error deleting voucher:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}