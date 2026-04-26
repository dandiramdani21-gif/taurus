// app/api/transactions/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { TransactionStatus } from "@/generated/client";

function isValidStatus(value: string): value is TransactionStatus {
  return value === "PAID" || value === "REFUND";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        user: {
          select: { name: true }
        },
        items: {
          include: {
            phone: {
              select: { brand: true, type: true, imei: true, image: true }
            },
            accessory: {
              select: { name: true, code: true, image: true }
            },
            voucher: {
              select: { name: true, code: true, image: true }
            },
            pulsa: {
              select: { denomination: true, code: true, note: true, image: true, destinationNumber: true, description: true, balance: true }
            },
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const nextStatusRaw = body?.status ? String(body.status) : null;
    const nextDeletedRaw = typeof body?.deleted === "boolean" ? body.deleted : null;

    if (nextStatusRaw !== null && !isValidStatus(nextStatusRaw)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    }

    if (nextStatusRaw === null && nextDeletedRaw === null) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!transaction) {
        throw new Error("NOT_FOUND");
      }

      const prevStatus = transaction.status;
      const nextStatus = nextStatusRaw as TransactionStatus | null;
      const nextDeleted = nextDeletedRaw;
      if ((nextStatus === null || prevStatus === nextStatus) && (nextDeleted === null || transaction.deleted === nextDeleted)) {
        return transaction;
      }

      const shouldRevertSale = nextStatus === "REFUND" && prevStatus === "PAID";
      const shouldApplySale = nextStatus === "PAID" && prevStatus === "REFUND";

      if (shouldRevertSale || shouldApplySale) {
        for (const item of transaction.items) {
          const qty = Number(item.quantity || 1);

          if (item.phoneId) {
            await tx.phone.update({
              where: { id: item.phoneId },
              data: {
                stock: { [shouldRevertSale ? "increment" : "decrement"]: qty },
                isHidden: shouldRevertSale ? false : true,
              },
            });
          }

          if (item.accessoryId) {
            await tx.accessory.update({
              where: { id: item.accessoryId },
              data: {
                stock: { [shouldRevertSale ? "increment" : "decrement"]: qty },
              },
            });
          }

          if (item.voucherId) {
            await tx.voucher.update({
              where: { id: item.voucherId },
              data: {
                stock: { [shouldRevertSale ? "increment" : "decrement"]: qty },
              },
            });
          }

          const isPulsaItem = Boolean(item.pulsaId || item.pulsaDestinationNumber || item.pulsaDescription);
          if (isPulsaItem) {
            const currentBalance = Number(item.pulsaBalance || 0);
            const modal = Number(item.costPrice || 0) * qty;
            const nextBalance = shouldRevertSale
              ? currentBalance + modal
              : Math.max(0, currentBalance - modal);

            await tx.transactionItem.update({
              where: { id: item.id },
              data: {
                pulsaBalance: nextBalance,
              },
            });
          }
        }
      }

      return tx.transaction.update({
        where: { id },
        data: {
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(nextDeleted !== null ? { deleted: nextDeleted } : {}),
        },
        include: {
          items: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    console.error("Error updating transaction status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
