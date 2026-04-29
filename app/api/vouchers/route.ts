// app/api/vouchers/route.ts 
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

function buildVoucherCode(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const suffix = Date.now().toString(36).toUpperCase();
  return `VCH-${base || "VOUCHER"}-${suffix}`;
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
    const dateFilter = parseDate(search);

    const skip = (page - 1) * limit;

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
                }
              },
            ]
            : []),
          ...(dateFilter
            ? [
              {
                expiredAt: {
                  gte: dateFilter.start,
                  lte: dateFilter.end,
                }
              },
            ]
            : []),
        ],
      }
      : { ...(deleted === undefined ? {} : { deleted }) };

    const [vouchers, total, summaries] = await Promise.all([
      prisma.voucher.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.voucher.count({ where }),
      prisma.$transaction(async (tx) => {
        // Ambil semua vouchers yang tidak deleted
        const vouchersData = await tx.voucher.findMany({
          where: {
            deleted: false,
            ...(search ? {
              OR: [
                { code: { contains: search, mode: "insensitive" as const } },
                { name: { contains: search, mode: "insensitive" as const } },
              ]
            } : {})
          },
          select: {
            id: true,
            costPrice: true,
            stock: true,
          },
        });

        const ids = vouchersData.map(v => v.id);

        // Total Assets: sum dari (costPrice * stock)
        const total_assets = vouchersData.reduce((sum, item) => sum + (item.costPrice * item.stock), 0);

        // Total Sold & Profits dari TransactionItem join Transaction status PAID
        const transactionStats = await tx.transactionItem.aggregate({
          where: {
            voucherId: {
              in: ids,
            },
            transaction: {
              status: "PAID",
              deleted: false,
            },
          },
          _sum: {
            quantity: true,
            sellPrice: true,
            costPrice: true,
          },
        });

        const total_solds = transactionStats?._sum?.quantity ?? 0;
        const total_revenue = transactionStats?._sum?.sellPrice ?? 0;
        const total_cost = transactionStats?._sum?.costPrice ?? 0;
        const profits = total_revenue - total_cost;

        return {
          total_assets,
          total_solds,
          profits,
        };
      }),
    ]);

    return NextResponse.json({
      vouchers,
      summaries,
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
    const voucherCode = typeof code === "string" && code.trim() ? code.trim() : buildVoucherCode(name);

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nama voucher diperlukan" }, { status: 400 });
    }

    const existing = await prisma.voucher.findUnique({ where: { code: voucherCode } });
    if (existing) {
      return NextResponse.json({ error: "Kode voucher sudah terdaftar" }, { status: 400 });
    }

    const voucher = await prisma.voucher.create({
      data: {
        code: voucherCode,
        name: name.trim(),
        costPrice: parseInt(costPrice),
        sellPrice: parseInt(sellPrice),
        stock: parseInt(stock) || 0,
        image: image || null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        expiredAt: expiredAt ? new Date(expiredAt) : null,
      },
    });

    if (parseInt(stock) > 0) {
      await logRestock({
        category: "PRODUK_LAIN",
        productType: "VOUCHER",
        productId: voucher.id,
        productName: voucher.name,
        quantity: parseInt(stock),
        previousStock: 0,
        newStock: voucher.stock,
        costPrice: voucher.costPrice,
        note: "Input awal inventory voucher",
        userId: session.user.id,
      });
    }

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
    const { id, name, costPrice, sellPrice, stock, image, entryDate, expiredAt, deleted } = body;
    const existingVoucher = await prisma.voucher.findUnique({
      where: { id },
      select: { stock: true, name: true, costPrice: true },
    });

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const updateData: Parameters<typeof prisma.voucher.update>[0]["data"] = {};
    if (name !== undefined) updateData.name = name.trim();
    if (costPrice !== undefined) updateData.costPrice = parseInt(costPrice);
    if (sellPrice !== undefined) updateData.sellPrice = parseInt(sellPrice);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (image !== undefined) updateData.image = image || null;
    if (entryDate !== undefined) updateData.entryDate = entryDate ? new Date(entryDate) : undefined;
    if (expiredAt !== undefined) updateData.expiredAt = expiredAt ? new Date(expiredAt) : null;
    if (deleted !== undefined) updateData.deleted = Boolean(deleted);

    const voucher = await prisma.voucher.update({
      where: { id },
      data: updateData,
    });

    if (existingVoucher && typeof stock !== "undefined" && parseInt(stock) !== existingVoucher.stock) {
      await logRestock({
        category: "PRODUK_LAIN",
        productType: "VOUCHER",
        productId: id,
        productName: name ?? existingVoucher.name,
        quantity: Math.abs(parseInt(stock) - existingVoucher.stock),
        previousStock: existingVoucher.stock,
        newStock: parseInt(stock),
        costPrice: costPrice ? parseInt(costPrice) : existingVoucher.costPrice,
        source: "ADJUSTMENT",
        note: "Penyesuaian stok voucher",
        userId: session.user.id,
      });
    }

    return NextResponse.json(voucher);
  } catch (error: unknown) {
    console.error("Error updating voucher:", error);
    if (isPrismaNotFoundError(error)) {
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

    await prisma.voucher.update({ where: { id }, data: { deleted: true } });

    return NextResponse.json({ message: "Voucher berhasil diarsipkan" });
  } catch (error: unknown) {
    console.error("Error deleting voucher:", error);
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
