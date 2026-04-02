import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

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
    const category = searchParams.get("category") || "all";

    const skip = (page - 1) * limit;

    let products: any[] = [];
    let phones: any[] = [];

    // Get Products (Accessories, Voucher, Pulsa)
    if (category === "all" || category === "ACCESSORY" || category === "VOUCHER" || category === "PULSA") {
      const productWhere: any = {};
      
      if (category !== "all") {
        productWhere.category = category;
      }
      
      if (search) {
        productWhere.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ];
      }
      
      products = await prisma.product.findMany({
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
        },
        orderBy: { name: "asc" },
      });
    }

    // Get Phones (HP)
    if (category === "all" || category === "PHONE") {
      const phoneWhere: any = {
        stock: { gt: 0 },
      };
      
      if (search) {
        phoneWhere.OR = [
          { brand: { contains: search, mode: "insensitive" } },
          { type: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ];
      }
      
      phones = await prisma.phone.findMany({
        where: phoneWhere,
        select: {
          id: true,
          code: true,
          brand: true,
          type: true,
          purchasePrice: true,
          stock: true,
          image: true,
        },
        orderBy: { brand: "asc" },
      });
    }

    // Format phones as products
    const formattedPhones = phones.map(phone => ({
      id: phone.id,
      code: phone.code,
      name: `${phone.brand} ${phone.type}`,
      category: "PHONE",
      costPrice: phone.purchasePrice,
      sellPrice: phone.purchasePrice,
      stock: phone.stock,
      image: phone.image,
    }));

    const allProducts = [...products, ...formattedPhones];
    
    // Apply search filter for combined results (if needed)
    let filteredProducts = allProducts;
    if (search && category === "all") {
      const searchLower = search.toLowerCase();
      filteredProducts = allProducts.filter(product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.code.toLowerCase().includes(searchLower)
      );
    }
    
    const total = filteredProducts.length;
    const paginatedProducts = filteredProducts.slice(skip, skip + limit);

    return NextResponse.json({
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching kasir products:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}