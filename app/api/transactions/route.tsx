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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const deletedParam = searchParams.get("deleted");
    const deleted =
      deletedParam === "true" ? true : deletedParam === "false" || deletedParam === null ? false : undefined;
    const skip = (page - 1) * limit;

    // Build where clause with proper types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // Handle type with proper enum validation
    if (isValidTransactionType(typeParam)) {
      where.type = typeParam;
    }

    // Handle category with proper enum validation
    if (isValidCategory(categoryParam)) {
      where.category = categoryParam;
    }

    if (deleted !== undefined) {
      where.deleted = deleted;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Handle search - search across transaction and product-specific fields
    if (search.trim()) {
      const searchTerm = search.trim();

      where.OR = [
        // Transaction-level search
        { id: { contains: searchTerm, mode: "insensitive" } },
        { invoiceNumber: { contains: searchTerm, mode: "insensitive" } },
        { note: { contains: searchTerm, mode: "insensitive" } },
        // HP search: IMEI, brand, type
        { items: { some: { phone: { imei: { contains: searchTerm, mode: "insensitive" } } } } },
        { items: { some: { phone: { brand: { contains: searchTerm, mode: "insensitive" } } } } },
        { items: { some: { phone: { type: { contains: searchTerm, mode: "insensitive" } } } } },
        // Accessory search: name, code
        { items: { some: { accessory: { name: { contains: searchTerm, mode: "insensitive" } } } } },
        { items: { some: { accessory: { code: { contains: searchTerm, mode: "insensitive" } } } } },
        // Voucher search: name, code
        { items: { some: { voucher: { name: { contains: searchTerm, mode: "insensitive" } } } } },
        { items: { some: { voucher: { code: { contains: searchTerm, mode: "insensitive" } } } } },
        // Pulsa search: destination number, code, description
        { items: { some: { pulsa: { destinationNumber: { contains: searchTerm, mode: "insensitive" } } } } },
        { items: { some: { pulsa: { code: { contains: searchTerm, mode: "insensitive" } } } } },
        { items: { some: { pulsa: { description: { contains: searchTerm, mode: "insensitive" } } } } },
        { items: { some: { pulsaDestinationNumber: { contains: searchTerm, mode: "insensitive" } } } },

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