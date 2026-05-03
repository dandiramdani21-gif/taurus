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
    const nextDeletedRaw = typeof body?.deleted === "boolean" ? body.deleted : null;
    const nextDebtNote = typeof body?.debt_note === "string" ? body.debt_note.trim() : null;

    // Hanya untuk update debt_note dan deleted (status sudah tidak ada di sini)
    if (nextDeletedRaw === null && nextDebtNote === null) {
      return NextResponse.json({ error: "Tidak ada perubahan yang dikirim" }, { status: 400 });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(nextDeletedRaw !== null ? { deleted: nextDeletedRaw } : {}),
        ...(nextDebtNote !== null ? { debt_note: nextDebtNote } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating transaction:", error);
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}