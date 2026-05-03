import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { notifyTelegram, sendTelegramDocument } from "@/lib/notifications";
import { getValidatedSessionUser } from "@/lib/session-user";
import { buildInvoicePdfBuffer } from "@/lib/invoice-pdf";
import { generateInvoiceNumber } from "@/lib/invoice-number";

function formatMoney(value: number) {
  return `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = await getValidatedSessionUser(session);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const latestTransaction = await prisma.transaction.findFirst({
      where: {
        category: "PULSA",
        type: "SALE",
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          select: {
            pulsaBalance: true,
          },
        },
      },
    });

    const balance =
      latestTransaction?.items.find((item) => item.pulsaBalance !== null && item.pulsaBalance !== undefined)
        ?.pulsaBalance ?? null;

    return NextResponse.json({
      balance,
      transactionId: latestTransaction?.id || null,
      updatedAt: latestTransaction?.createdAt || null,
    });
  } catch (error) {
    console.error("Error fetching latest pulsa balance:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = await getValidatedSessionUser(session);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      items = [],
      totalAmount,
      totalCost,
      profit,
      note,
      destinationNumber,
      description,
      balance,
      sellPrice,
      costPrice,
    } = body;

    const hasLegacyItems = Array.isArray(items) && items.length > 0;
    const enteredBalance = balance !== undefined && balance !== null ? Number(balance) : null;
    const usedCost = Number(costPrice ?? totalCost ?? 0);
    const remainingBalance =
      enteredBalance !== null && Number.isFinite(enteredBalance)
        ? Math.max(0, enteredBalance - usedCost)
        : null;

    const persistedInvoiceNumber = generateInvoiceNumber();
    const transaction = await prisma.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          invoiceNumber: persistedInvoiceNumber,
          type: "SALE",
          category: "PULSA",
          totalAmount: Number(totalAmount ?? sellPrice ?? 0),
          totalCost: Number(totalCost ?? costPrice ?? 0),
          profit: Number(profit ?? (Number(sellPrice ?? 0) - Number(costPrice ?? 0))),
          note: note || description || "Penjualan Pulsa",
          userId: user.id,
          servedByName: user.name || null,
        },
      });

      if (hasLegacyItems) {
        for (const item of items) {
          await tx.transactionItem.create({
            data: {
              transactionId: newTransaction.id,
              pulsaId: item.productId ?? null,
              quantity: Number(item.quantity || 1),
              sellPrice: Number(item.sellPrice ?? 0),
              costPrice: Number(item.costPrice ?? 0),
              status: "PAID"
            },
          });
        }
      } else {
        await tx.transactionItem.create({
          data: {
            transactionId: newTransaction.id,
            quantity: 1,
            sellPrice: Number(sellPrice ?? totalAmount ?? 0),
            costPrice: Number(costPrice ?? totalCost ?? 0),
            pulsaDestinationNumber: destinationNumber || null,
            pulsaDescription: description || note || null,
            pulsaBalance: remainingBalance,
          },
        });
      }

      return newTransaction;
    });

    const invoiceNumber = transaction.invoiceNumber || persistedInvoiceNumber;
    const invoicePdf = buildInvoicePdfBuffer({
      invoiceNumber,
      invoiceDate: new Date(transaction.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      storeName: "Taurus Cellular",
      storeAddressLines: [
        "Jl. Raya Tanjungsari No.129",
        "Kec. Tanjungsari, Kabupaten Sumedang",
        "Jawa Barat, 45362",
        "0857-5902-5901",
      ],
      categoryLabel: "Pulsa",
      items: [
        {
          name: description || note || "Pulsa",
          code: destinationNumber || "-",
          detail: remainingBalance !== null ? `Sisa saldo: ${formatMoney(remainingBalance)}` : null,
          quantity: 1,
          unitPrice: Number(sellPrice ?? totalAmount ?? 0),
          total: Number(totalAmount ?? sellPrice ?? 0),
        },
      ],
      totalAmount: Number(totalAmount ?? sellPrice ?? 0),
      totalCost: Number(totalCost ?? costPrice ?? 0),
      profit: Number(profit ?? (Number(sellPrice ?? 0) - Number(costPrice ?? 0))),
      notes: [`Kasir: ${user.name || "-"}`],
      footer: "Terima kasih telah berbelanja di Taurus Cellular.",
    });

    await Promise.allSettled([
      sendTelegramDocument({
        title: "Invoice Checkout Pulsa",
        message: [
          `Invoice: ${invoiceNumber}`,
          `Total: ${formatMoney(Number(totalAmount ?? sellPrice ?? 0))}`,
          destinationNumber ? `Tujuan: ${destinationNumber}` : null,
          description ? `Keterangan: ${description}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        filename: `${invoiceNumber}.pdf`,
        document: invoicePdf,
      }),
      notifyTelegram({
        title: "Transaksi Pulsa",
        message: [
          `Invoice: ${invoiceNumber}`,
          `Total: Rp ${Number(totalAmount ?? sellPrice ?? 0).toLocaleString("id-ID")}`,
          destinationNumber ? `Tujuan: ${destinationNumber}` : null,
          description ? `Keterangan: ${description}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    ]);

    return NextResponse.json({
      success: true,
      id: transaction.id,
      invoiceNumber,
      balance: remainingBalance,
      message: "Checkout pulsa berhasil",
    });
  } catch (error: unknown) {
    console.error("Checkout Pulsa Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Terjadi kesalahan saat checkout",
      },
      { status: 500 }
    );
  }
}
