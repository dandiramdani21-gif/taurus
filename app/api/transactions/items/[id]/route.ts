import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;
    console.log(id, body)

    if (!status || !["PAID", "REFUND"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be PAID or REFUND" },
        { status: 400 }
      );
    }

    // Update status di TransactionItem dengan handling stock
    const updatedItem = await prisma.$transaction(async (tx) => {
      // Ambil item yang akan diupdate
      const item = await tx.transactionItem.findUnique({
        where: { id },
        include: {
          transaction: true,
        },
      });

      if (!item) {
        throw new Error("Item not found");
      }

      const oldStatus = item.status;
      const newStatus = status;
      
      // Jika status berubah
      if (oldStatus !== newStatus) {
        const qty = Number(item.quantity || 1);
        const isRefunding = newStatus === "REFUND" && oldStatus === "PAID";
        const isReinstating = newStatus === "PAID" && oldStatus === "REFUND";

        // Handle stock changes
        if (isRefunding) {
          // REFUND: stok kembali
          if (item.phoneId) {
            await tx.phone.update({
              where: { id: item.phoneId },
              data: {
                stock: { increment: qty },
                isHidden: false,
              },
            });
          }

          if (item.accessoryId) {
            await tx.accessory.update({
              where: { id: item.accessoryId },
              data: {
                stock: { increment: qty },
              },
            });
          }

          if (item.voucherId) {
            await tx.voucher.update({
              where: { id: item.voucherId },
              data: {
                stock: { increment: qty },
              },
            });
          }

          // Untuk pulsa
          if (item.pulsaId || item.pulsaDestinationNumber) {
            const currentBalance = Number(item.pulsaBalance || 0);
            const modal = Number(item.costPrice || 0) * qty;
            await tx.transactionItem.update({
              where: { id: item.id },
              data: {
                pulsaBalance: currentBalance + modal,
              },
            });
          }
        } else if (isReinstating) {
          // PAID kembali: stok berkurang lagi
          if (item.phoneId) {
            await tx.phone.update({
              where: { id: item.phoneId },
              data: {
                stock: { decrement: qty },
                isHidden: true,
              },
            });
          }

          if (item.accessoryId) {
            await tx.accessory.update({
              where: { id: item.accessoryId },
              data: {
                stock: { decrement: qty },
              },
            });
          }

          if (item.voucherId) {
            await tx.voucher.update({
              where: { id: item.voucherId },
              data: {
                stock: { decrement: qty },
              },
            });
          }

          // Untuk pulsa
          if (item.pulsaId || item.pulsaDestinationNumber) {
            const currentBalance = Number(item.pulsaBalance || 0);
            const modal = Number(item.costPrice || 0) * qty;
            await tx.transactionItem.update({
              where: { id: item.id },
              data: {
                pulsaBalance: Math.max(0, currentBalance - modal),
              },
            });
          }
        }

        // Update status item
        await tx.transactionItem.update({
          where: { id },
          data: { status: newStatus },
        });
      }

      // Recalculate transaction totals berdasarkan semua item yang PAID
      const allItems = await tx.transactionItem.findMany({
        where: { transactionId: item.transactionId },
      });

      const totalAmount = allItems
        .filter((i) => i.status === "PAID")
        .reduce((sum, i) => sum + (i.sellPrice * i.quantity), 0);

      const totalCost = allItems
        .filter((i) => i.status === "PAID")
        .reduce((sum, i) => sum + (i.costPrice * i.quantity), 0);

      const profit = totalAmount - totalCost;

      // Update transaction totals
      await tx.transaction.update({
        where: { id: item.transactionId },
        data: {
          totalAmount,
          totalCost,
          profit,
        },
      });

      // Return updated item
      return tx.transactionItem.findUnique({
        where: { id },
        include: { transaction: true },
      });
    });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error("Error updating transaction item status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}