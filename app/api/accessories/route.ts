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

    const [accessories, total] = await Promise.all([
      prisma.accessory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.accessory.count({ where }),
    ]);

    return NextResponse.json({
      accessories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching accessories:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Create
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, costPrice, sellPrice, stock, image, entryDate } = body;

    // Cek kode unik
    const existing = await prisma.accessory.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "Kode sudah terdaftar" }, { status: 400 });
    }

    const accessory = await prisma.accessory.create({
      data: {
        code,
        name,
        costPrice: parseInt(costPrice),
        sellPrice: parseInt(sellPrice),
        stock: parseInt(stock) || 0,
        image: image || null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
      },
    });

    return NextResponse.json(accessory, { status: 201 });
  } catch (error) {
    console.error("Error creating accessory:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT - Update (lebih aman + cek unique code)
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, code, name, costPrice, sellPrice, stock, image, entryDate } = body;

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    // Cek kode unik jika code diubah
    if (code) {
      const existing = await prisma.accessory.findUnique({
        where: { code },
      });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Kode sudah terdaftar" }, { status: 400 });
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

    const accessory = await prisma.accessory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(accessory);
  } catch (error: any) {
    console.error("Error updating accessory:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
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

    // Optional: Cek apakah sudah dipakai di transaksi
    const used = await prisma.transactionItem.count({
      where: { accessoryId: id },
    });

    if (used > 0) {
      return NextResponse.json({ 
        error: "Tidak bisa dihapus karena sudah digunakan di transaksi" 
      }, { status: 400 });
    }

    await prisma.accessory.delete({ where: { id } });

    return NextResponse.json({ message: "Aksesoris berhasil dihapus" });
  } catch (error: any) {
    console.error("Error deleting accessory:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}