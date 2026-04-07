import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const whereCondition: any = {
      status: "ACTIVE",
    };

    if (startDate && endDate) {
      whereCondition.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate + "T23:59:59"),
      };
    }

    // Get all transactions with items
    const transactions = await prisma.transaction.findMany({
      where: whereCondition,
      include: {
        items: {
          include: {
            product: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const laporanData: any[] = [];
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalTransactions = transactions.length;
    let totalItemsSold = 0;

    // Process each transaction
    for (const transaction of transactions) {
      for (const item of transaction.items) {
        const product = item.product;
        const phone = item.phone;
        
        const productName = product?.name || (phone ? `${phone.brand} ${phone.type}` : "-");
        const productCode = product?.code || phone?.code || "-";
        const buyPrice = item.costPrice;
        const sellPrice = item.sellPrice;
        const quantity = item.quantity;
        const totalBuy = buyPrice * quantity;
        const totalSell = sellPrice * quantity;
        const profit = totalSell - totalBuy;

        totalRevenue += totalSell;
        totalCost += totalBuy;
        totalProfit += profit;
        totalItemsSold += quantity;

        // Hitung sisa stok (cari dari database)
        let stockLeft = 0;
        if (product) {
          stockLeft = product.stock;
        } else if (phone) {
          stockLeft = phone.stock;
        }

        laporanData.push({
          id: transaction.id,
          date: transaction.createdAt,
          type: transaction.type,
          productName,
          productCode,
          quantity,
          buyPrice,
          sellPrice,
          totalBuy,
          totalSell,
          profit,
          stockLeft,
        });
      }
    }

    // Get monthly sales data for chart
    const monthlyData = await getMonthlySalesData(startDate, endDate);

    return NextResponse.json({
      data: laporanData,
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        totalTransactions,
        totalItemsSold,
      },
      monthlyData,
    });
  } catch (error) {
    console.error("Laporan API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function getMonthlySalesData(startDate?: string | null, endDate?: string | null) {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
  const end = endDate ? new Date(endDate + "T23:59:59") : new Date();

  const transactions = await prisma.transaction.findMany({
    where: {
      status: "ACTIVE",
      type: "SALE",
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      createdAt: true,
      totalAmount: true,
    },
  });

  const monthlyMap = new Map();

  transactions.forEach((transaction) => {
    const monthYear = transaction.createdAt.toLocaleDateString("id-ID", {
      month: "short",
      year: "numeric",
    });
    const currentTotal = monthlyMap.get(monthYear) || 0;
    monthlyMap.set(monthYear, currentTotal + transaction.totalAmount);
  });

  const monthlyData = Array.from(monthlyMap.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => {
      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      return months.indexOf(a.month.split(" ")[0]) - months.indexOf(b.month.split(" ")[0]);
    });

  return monthlyData;
}