import { prisma } from "@/lib/prisma";
import type { ProductCategory } from "@/generated/client";

type GetLaporanParams = {
  startDate: string;
  endDate: string;
  category: ProductCategory;
};

export async function getCategoryLaporan({
  startDate,
  endDate,
  category,
}: GetLaporanParams) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      type: "SALE",
      category,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
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

  const totalRevenue = transactions.reduce(
    (sum, transaction) => sum + (transaction.status === "REFUND" ? -transaction.totalAmount : transaction.totalAmount),
    0
  );
  const totalCost = transactions.reduce(
    (sum, transaction) => sum + (transaction.status === "REFUND" ? -transaction.totalCost : transaction.totalCost),
    0
  );
  const totalProfit = transactions.reduce(
    (sum, transaction) => sum + (transaction.status === "REFUND" ? -transaction.profit : transaction.profit),
    0
  );

  const dailyMap = new Map<string, { date: string; revenue: number; cost: number; profit: number }>();

  transactions.forEach((transaction) => {
    const dateStr = transaction.createdAt.toISOString().split("T")[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { date: dateStr, revenue: 0, cost: 0, profit: 0 });
    }

    const day = dailyMap.get(dateStr)!;
    const sign = transaction.status === "REFUND" ? -1 : 1;
    day.revenue += transaction.totalAmount * sign;
    day.cost += transaction.totalCost * sign;
    day.profit += transaction.profit * sign;
  });

  const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    transactions,
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      transactionCount: transactions.length,
    },
    chartData,
  };
}
