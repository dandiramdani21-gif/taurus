// app/api/transactions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

function isValidCategory(category: string | null): category is "HANDPHONE" | "PRODUK_LAIN" | "PULSA" {
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
    const category = searchParams.get("category");
    const type = searchParams.get("type") || "SALE";
    const skip = (page - 1) * limit;

    const where: {
      type?: string;
      category?: "HANDPHONE" | "PRODUK_LAIN" | "PULSA";
      OR?: Array<
        | { id: { contains: string; mode: "insensitive" } }
        | { note: { contains: string; mode: "insensitive" } }
      >;
    } = {};

    if (type) {
      where.type = type;
    }

    if (isValidCategory(category)) {
      where.category = category;
    }

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
