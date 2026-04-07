import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

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
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            { brand: { contains: search, mode: "insensitive" as const } },
            { type: { contains: search, mode: "insensitive" as const } },
            { imei: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

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
    const { code, brand, type, imei, color, purchasePrice, stock, image, metadata, entryDate } = body;

    // Cek code sudah ada
    const existingCode = await prisma.phone.findUnique({
      where: { code },
    });
    if (existingCode) {
      return NextResponse.json({ error: "Kode barang sudah terdaftar" }, { status: 400 });
    }

    // Cek IMEI sudah ada
    const existingImei = await prisma.phone.findUnique({
      where: { imei },
    });
    if (existingImei) {
      return NextResponse.json({ error: "IMEI sudah terdaftar" }, { status: 400 });
    }

    const phone = await prisma.phone.create({
      data: {
        code,
        brand,
        type,
        imei,
        color: color || null,
        purchasePrice: parseInt(purchasePrice),
        purchaseDate: new Date(),
        entryDate: entryDate ? new Date(entryDate) : new Date(), // default hari ini
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
    const { id, code, brand, type, imei, color, purchasePrice, stock, image, metadata, entryDate } = body;

    // Build data object hanya dengan field yang dikirim
    const updateData: any = {};
    
    if (code !== undefined) updateData.code = code;
    if (brand !== undefined) updateData.brand = brand;
    if (type !== undefined) updateData.type = type;
    if (imei !== undefined) updateData.imei = imei;
    if (color !== undefined) updateData.color = color;
    if (purchasePrice !== undefined) updateData.purchasePrice = parseInt(purchasePrice);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (image !== undefined) updateData.image = image;
    if (entryDate !== undefined) updateData.entryDate = entryDate ? new Date(entryDate) : undefined;

    await prisma.phone.update({
      where: { id },
      data: updateData,
    });

    // Update metadata jika ada
    if (metadata && metadata.length > 0) {
      await prisma.phoneMetadata.deleteMany({
        where: { phoneId: id },
      });
      await prisma.phoneMetadata.createMany({
        data: metadata.map((m: any) => ({
          phoneId: id,
          key: m.key,
          value: m.value,
        })),
      });
    }

    const updatedPhone = await prisma.phone.findUnique({
      where: { id },
      include: { metadata: true },
    });

    return NextResponse.json(updatedPhone);
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