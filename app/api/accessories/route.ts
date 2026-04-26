import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { logRestock } from "@/lib/restock";


const parseDate = (dateStr: string) => {
  const [day, month, year] = dateStr.split("/").map(Number);
  if (!day || !month || !year) return null;

  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  return { start, end };
};

function buildAccessoryCode(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const suffix = Date.now().toString(36).toUpperCase();
  return `ACC-${base || "ACCESSORY"}-${suffix}`;
}

function isPrismaNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}

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
    const deletedParam = searchParams.get("deleted");
    const deleted =
      deletedParam === "true" ? true : deletedParam === "false" || deletedParam === null ? false : undefined;

    const skip = (page - 1) * limit;

    const dateFilter = parseDate(search);

    const where = search
      ? {
        ...(deleted === undefined ? {} : { deleted }),

        OR: [
          { code: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
          
          ...(dateFilter
            ? [
              {
                entryDate: {
                  gte: dateFilter.start,
                  lte: dateFilter.end,
                },
              },
            ]
            : []),
        ],
      }
      : { ...(deleted === undefined ? {} : { deleted }) };
      

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
    const accessoryCode = typeof code === "string" && code.trim() ? code.trim() : buildAccessoryCode(name);

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nama aksesoris diperlukan" }, { status: 400 });
    }

    const existing = await prisma.accessory.findUnique({ where: { code: accessoryCode } });
    if (existing) {
      return NextResponse.json({ error: "Kode sudah terdaftar" }, { status: 400 });
    }

    const accessory = await prisma.accessory.create({
      data: {
        code: accessoryCode,
        name: name.trim(),
        costPrice: parseInt(costPrice),
        sellPrice: parseInt(sellPrice),
        stock: parseInt(stock) || 0,
        image: image || null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
      },
    });

    if (parseInt(stock) > 0) {
      await logRestock({
        category: "PRODUK_LAIN",
        productType: "ACCESSORY",
        productId: accessory.id,
        productName: accessory.name,
        quantity: parseInt(stock),
        previousStock: 0,
        newStock: accessory.stock,
        costPrice: accessory.costPrice,
        note: "Input awal inventory aksesoris",
        userId: session.user.id,
      });
    }

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
    const { id, name, costPrice, sellPrice, stock, image, entryDate, deleted } = body;
    const existingAccessory = await prisma.accessory.findUnique({
      where: { id },
      select: { stock: true, name: true, costPrice: true },
    });

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const updateData: Parameters<typeof prisma.accessory.update>[0]["data"] = {};
    if (name !== undefined) updateData.name = name.trim();
    if (costPrice !== undefined) updateData.costPrice = parseInt(costPrice);
    if (sellPrice !== undefined) updateData.sellPrice = parseInt(sellPrice);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (image !== undefined) updateData.image = image || null;
    if (entryDate !== undefined) updateData.entryDate = entryDate ? new Date(entryDate) : undefined;
    if (deleted !== undefined) updateData.deleted = Boolean(deleted);

    const accessory = await prisma.accessory.update({
      where: { id },
      data: updateData,
    });

    if (existingAccessory && typeof stock !== "undefined" && parseInt(stock) !== existingAccessory.stock) {
      await logRestock({
        category: "PRODUK_LAIN",
        productType: "ACCESSORY",
        productId: id,
        productName: name ?? existingAccessory.name,
        quantity: Math.abs(parseInt(stock) - existingAccessory.stock),
        previousStock: existingAccessory.stock,
        newStock: parseInt(stock),
        costPrice: costPrice ? parseInt(costPrice) : existingAccessory.costPrice,
        source: "ADJUSTMENT",
        note: "Penyesuaian stok aksesoris",
        userId: session.user.id,
      });
    }

    return NextResponse.json(accessory);
  } catch (error: unknown) {
    console.error("Error updating accessory:", error);
    if (isPrismaNotFoundError(error)) {
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

    await prisma.accessory.update({ where: { id }, data: { deleted: true } });

    return NextResponse.json({ message: "Aksesoris berhasil diarsipkan" });
  } catch (error: unknown) {
    console.error("Error deleting accessory:", error);
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
