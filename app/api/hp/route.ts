import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { logRestock } from "@/lib/restock";
import type { Prisma } from "@/generated/client";

const parseDateInput = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return new Date();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
  }

  const text = String(value).trim();
  if (!text) return new Date();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parts = text.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map((part) => Number(part));
    if (day && month && year) {
      return new Date(year, month - 1, day);
    }
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
};

// GET all HP with metadata
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

    // Build where clause for search
    const where = search
      ? {
          isHidden: false,
          OR: [
            { brand: { contains: search, mode: "insensitive" as const } },
            { type: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : { isHidden: false };

    const [phones, total] = await Promise.all([
      prisma.phone.findMany({
        where,
        include: {
          metadata: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.phone.count({ where }),
    ]);

    return NextResponse.json({
      phones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching phones:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST create HP
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brand, type, imei, color, purchasePrice, purchaseDate, stock, image, metadata, entryDate } = body;

    // Cek IMEI sudah ada
    const existingImei = await prisma.phone.findUnique({
      where: { imei },
    });
    if (existingImei) {
      return NextResponse.json({ error: "IMEI sudah terdaftar" }, { status: 400 });
    }

    const phone = await prisma.phone.create({
      data: {
        brand,
        type,
        imei,
        color: color || null,
        purchasePrice: parseInt(purchasePrice),
        purchaseDate: parseDateInput(purchaseDate),
        entryDate: parseDateInput(entryDate), // default hari ini
        stock: parseInt(stock) || 1,
        image: image || null,
        metadata: {
          create: metadata || [],
        },
      },
      include: {
        metadata: true,
      },
    });

    if ((parseInt(stock) || 1) > 0) {
      await logRestock({
        category: "HANDPHONE",
        productType: "PHONE",
        productId: phone.id,
        productName: `${phone.brand} ${phone.type}`,
        quantity: parseInt(stock) || 1,
        previousStock: 0,
        newStock: phone.stock,
        costPrice: phone.purchasePrice,
        note: "Input awal inventory handphone",
        userId: session.user.id,
      });
    }

    return NextResponse.json(phone, { status: 201 });
  } catch (error) {
    console.error("Error creating phone:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT update HP
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, brand, type, imei, color, purchasePrice, purchaseDate, stock, image, metadata, entryDate } = body;
    const existingPhone = await prisma.phone.findUnique({
      where: { id },
      select: { stock: true, brand: true, type: true, purchasePrice: true },
    });

    // Build data object hanya dengan field yang dikirim
    const updateData: Prisma.PhoneUpdateInput = {};
    
    if (brand !== undefined) updateData.brand = brand;
    if (type !== undefined) updateData.type = type;
    if (imei !== undefined) updateData.imei = imei;
    if (color !== undefined) updateData.color = color;
    if (purchasePrice !== undefined) updateData.purchasePrice = parseInt(purchasePrice);
    if (purchaseDate !== undefined) updateData.purchaseDate = parseDateInput(purchaseDate);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (image !== undefined) updateData.image = image;
    if (entryDate !== undefined) updateData.entryDate = parseDateInput(entryDate);

    const updatedPhone = await prisma.phone.update({
      where: { id },
      data: updateData,
    });

    // Update metadata jika ada
    if (Array.isArray(metadata) && metadata.length > 0) {
      await prisma.phoneMetadata.deleteMany({
        where: { phoneId: id },
      });
      await prisma.phoneMetadata.createMany({
        data: metadata.map((m: { key: string; value: string }) => ({
          phoneId: id,
          key: m.key,
          value: m.value,
        })),
      });
    }

    const refreshedPhone = await prisma.phone.findUnique({
      where: { id },
      include: { metadata: true },
    });

    const nextStock = typeof stock !== "undefined" ? parseInt(stock) : updatedPhone.stock;
    if (existingPhone && typeof stock !== "undefined" && nextStock !== existingPhone.stock) {
      await logRestock({
        category: "HANDPHONE",
        productType: "PHONE",
        productId: id,
        productName: `${brand ?? existingPhone.brand} ${type ?? existingPhone.type}`,
        quantity: Math.abs(nextStock - existingPhone.stock),
        previousStock: existingPhone.stock,
        newStock: nextStock,
        costPrice: purchasePrice ? parseInt(purchasePrice) : existingPhone.purchasePrice,
        source: "ADJUSTMENT",
        note: "Penyesuaian stok handphone",
        userId: session.user.id,
      });
    }

    return NextResponse.json(refreshedPhone);
  } catch (error) {
    console.error("Error updating phone:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE HP
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await prisma.phone.delete({
      where: { id },
    });

    return NextResponse.json({ message: "HP deleted successfully" });
  } catch (error) {
    console.error("Error deleting phone:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
