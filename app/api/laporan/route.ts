// app/api/laporan/route.ts
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
    const productType = searchParams.get("productType"); // all, phone, accessory, voucher, pulsa

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Tanggal mulai dan akhir diperlukan" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // sampai akhir hari

    // Filter dasar
    let whereClause: any = {
      type: "SALE",
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    // Filter berdasarkan tipe produk
    if (productType && productType !== "all") {
      whereClause.items = {
        some: {},
      };

      if (productType === "phone") whereClause.items.some.phoneId = { not: null };
      if (productType === "accessory") whereClause.items.some.accessoryId = { not: null };
      if (productType === "voucher") whereClause.items.some.voucherId = { not: null };
      if (productType === "pulsa") whereClause.items.some.pulsaId = { not: null };
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
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
    });

    // Hitung ringkasan
    const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalCost = transactions.reduce((sum, t) => sum + t.totalCost, 0);
    const totalProfit = transactions.reduce((sum, t) => sum + t.profit, 0);

    // Data untuk chart (group by tanggal)
    const dailyMap = new Map<string, any>();

    transactions.forEach((t) => {
      const dateStr = t.createdAt.toISOString().split("T")[0]; // yyyy-mm-dd
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { date: dateStr, revenue: 0, cost: 0, profit: 0 });
      }
      const day = dailyMap.get(dateStr)!;
      day.revenue += t.totalAmount;
      day.cost += t.totalCost;
      day.profit += t.profit;
    });

    const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      transactions,
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        transactionCount: transactions.length,
      },
      chartData,
    });
  } catch (error) {
    console.error("Error fetching laporan:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}