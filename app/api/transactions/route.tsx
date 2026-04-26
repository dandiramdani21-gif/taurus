// app/api/transactions/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { TransactionType, ProductCategory } from "@/generated/client";

// Type guards
function isValidTransactionType(type: string | null): type is TransactionType {
  return type === "SALE" || type === "PURCHASE";
}

function isValidCategory(category: string | null): category is ProductCategory {
  return category === "HANDPHONE" || category === "PRODUK_LAIN" || category === "PULSA";
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const search = searchParams.get("search") || "";
    const categoryParam = searchParams.get("category");
    const typeParam = searchParams.get("type") || "SALE";
    const skip = (page - 1) * limit;

    // Build where clause with proper types
    const where: {
      type?: TransactionType;
      category?: ProductCategory;
      OR?: Array<
        | { id: { contains: string; mode: "insensitive" } }
        | { note: { contains: string; mode: "insensitive" } }
      >;
    } = {};

    // Handle type with proper enum validation
    if (isValidTransactionType(typeParam)) {
      where.type = typeParam;
    }

    // Handle category with proper enum validation
    if (isValidCategory(categoryParam)) {
      where.category = categoryParam;
    }

    // Handle search
    if (search.trim()) {
      where.OR = [
        { id: { contains: search.trim(), mode: "insensitive" } },
        { note: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          items: {
            include: {
              phone: true,
              accessory: true,
              voucher: true,
              pulsa: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}