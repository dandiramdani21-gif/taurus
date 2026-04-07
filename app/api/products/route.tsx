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
    const category = searchParams.get("category");

    const skip = (page - 1) * limit;

    // Build search condition
    const searchCondition = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { brand: { contains: search, mode: "insensitive" } },
            { type: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    // Get Products (Accessories, Voucher, Pulsa)
    const productWhere: any = { ...searchCondition };
    if (category && category !== "all" && category !== "PHONE") {
      productWhere.category = category;
    }

    const products = await prisma.product.findMany({
      where: productWhere,
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        costPrice: true,
        sellPrice: true,
        stock: true,
        image: true,
        entryDate: true,
      },
      orderBy: { name: "asc" },
    });

    // Get Phones (HP)
    const phoneWhere: any = { ...searchCondition };
    if (category === "all" || category === "PHONE") {
      // Filter hanya yang stock > 0 atau tampilkan semua
    }

    const phones = await prisma.phone.findMany({
      where: {
        ...phoneWhere,
        stock: { gt: 0 }, // hanya tampilkan yang ada stok
      },
      select: {
        id: true,
        code: true,
        brand: true,
        type: true,
        purchasePrice: true,
        stock: true,
        image: true,
        entryDate: true,
      },
      orderBy: { brand: "asc" },
    });

    // Combine and format
    const allItems = [
      ...products.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        costPrice: p.costPrice || 0,
        sellPrice: p.sellPrice || p.costPrice || 0,
        stock: p.stock,
        type: "product",
        image: p.image,
        entryDate: p.entryDate
      })),
      ...phones.map(p => ({
        id: p.id,
        code: p.code,
        name: `${p.brand} ${p.type}`,
        category: "PHONE",
        costPrice: p.purchasePrice,
        sellPrice: p.purchasePrice, // harga jual awal = harga modal
        stock: p.stock,
        type: "phone",
        image: p.image,
        entryDate: p.entryDate
      })),
    ];

    // Apply search manually for combined items
    let filteredItems = allItems;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredItems = allItems.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.code.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (category && category !== "all") {
      filteredItems = filteredItems.filter(item => item.category === category);
    }

    // Pagination
    const total = filteredItems.length;
    const paginatedItems = filteredItems.slice(skip, skip + limit);

    return NextResponse.json({
      products: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST create product
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, category, costPrice, sellPrice, stock, image, entryDate } = body;

    const existingCode = await prisma.product.findUnique({
      where: { code },
    });
    if (existingCode) {
      return NextResponse.json({ error: "Kode produk sudah terdaftar" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        code,
        name,
        category,
        costPrice: parseInt(costPrice),
        sellPrice: sellPrice ? parseInt(sellPrice) : parseInt(costPrice),
        stock: parseInt(stock) || 0,
        image: image || null,
        entryDate: entryDate ? new Date(entryDate) : new Date(), // ✅ tambah ini
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT update product
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, code, name, category, costPrice, sellPrice, stock, image, entryDate } = body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        code,
        name,
        category,
        costPrice: parseInt(costPrice),
        sellPrice: sellPrice ? parseInt(sellPrice) : parseInt(costPrice),
        stock: parseInt(stock),
        image: image || null,
        entryDate: entryDate ? new Date(entryDate) : undefined, // ✅ tambah ini
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}