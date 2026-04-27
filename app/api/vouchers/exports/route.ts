import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const [vouchers, solds] = await Promise.all([
      // Daftar Voucher
      prisma.voucher.findMany({
        where: {
          ...(includeDeleted ? {} : { deleted: false }),
        },
        select: {
          code: true,
          name: true,
          costPrice: true,
          sellPrice: true,
          stock: true,
          entryDate: true,
          expiredAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      
      // Voucher Terjual
      prisma.voucher.findMany({
        where: {
          transactionItems: {
            some: {
              transaction: {
                status: "PAID",
                deleted: false,
              },
            },
          },
        },
        select: {
          code: true,
          name: true,
          costPrice: true,
          entryDate: true,
          transactionItems: {
            where: {
              transaction: {
                status: "PAID",
                deleted: false,
              },
            },
            select: {
              sellPrice: true,
              quantity: true,
              transaction: {
                select: {
                  createdAt: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Format solds
    const formattedSolds = solds.flatMap(item => {
      const { transactionItems, ...itemData } = item;
      return transactionItems.map(ti => ({
        ...itemData,
        sellPrice: ti.sellPrice,
        quantity: ti.quantity,
        soldDate: ti.transaction.createdAt,
      }));
    });

    return NextResponse.json({
      vouchers,
      solds: formattedSolds,
    });
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}