import { prisma } from "@/lib/prisma";
import type { ProductCategory } from "@/generated/client";

type GetLaporanParams = {
  startDate: string;
  endDate: string;
  category: ProductCategory;
  search: string | null;
};

export async function getCategoryLaporan({
  startDate,
  endDate,
  category,
  search,
}: GetLaporanParams) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // WHERE condition untuk semua transaksi (termasuk REFUND)
  const whereCondition = {
    type: "SALE" as const,
    category: category,
    deleted: false,
    createdAt: {
      gte: start,
      lte: end,
    },
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" as const } },
            {
              items: {
                some: {
                  OR: [
                    { phone: { imei: { contains: search, mode: "insensitive" as const } } },
                    { phone: { brand: { contains: search, mode: "insensitive" as const } } },
                    { phone: { type: { contains: search, mode: "insensitive" as const } } },
                    { accessory: { name: { contains: search, mode: "insensitive" as const } } },
                    { accessory: { code: { contains: search, mode: "insensitive" as const } } },
                    { voucher: { name: { contains: search, mode: "insensitive" as const } } },
                    { voucher: { code: { contains: search, mode: "insensitive" as const } } },
                    { pulsa: { description: { contains: search, mode: "insensitive" as const } } },
                    { pulsa: { code: { contains: search, mode: "insensitive" as const } } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  // WHERE condition untuk summary (hanya PAID)
  const whereConditionPaid = {
    ...whereCondition,
    status: "PAID" as const,
  };

  // WHERE condition untuk keuntungan hari ini
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const todayWhereCondition = {
    type: "SALE" as const,
    category: category,
    deleted: false,
    status: "PAID" as const,
    createdAt: {
      gte: todayStart,
      lte: todayEnd,
    },
  };

  const [transactions, aggregateResult, todayAggregate] = await Promise.all([
    // Ambil semua transaksi (include REFUND)
    prisma.transaction.findMany({
      where: whereCondition,
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
    }),
    
    // Summary total revenue, cost, profit (hanya PAID)
    prisma.transaction.aggregate({
      where: whereConditionPaid,
      _sum: {
        totalAmount: true,
        totalCost: true,
        profit: true,
      },
    }),
    
    // Keuntungan hari ini (independen, tidak kena filter bulan)
    prisma.transaction.aggregate({
      where: todayWhereCondition,
      _sum: {
        profit: true,
      },
    }),
  ]);

  // Hitung total transaksi PAID
  const paidTransactions = transactions.filter(t => t.status === "PAID");
  const totalCount = paidTransactions.length;

  const totalRevenue = aggregateResult._sum.totalAmount || 0;
  const totalCost = aggregateResult._sum.totalCost || 0;
  const totalProfit = aggregateResult._sum.profit || 0;
  const todayProfit = todayAggregate._sum.profit || 0;

  // Daily breakdown (hanya untuk transaksi PAID)
  const dailyMap = new Map<string, { date: string; revenue: number; cost: number; profit: number }>();

  paidTransactions.forEach((transaction) => {
    const dateStr = transaction.createdAt.toISOString().split("T")[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { date: dateStr, revenue: 0, cost: 0, profit: 0 });
    }

    const day = dailyMap.get(dateStr)!;
    day.revenue += transaction.totalAmount;
    day.cost += transaction.totalCost;
    day.profit += transaction.profit;
  });

  const dailySummary = Array.from(dailyMap.values());

  return {
    transactions,
    dailySummary,
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      todayProfit,        // ← KEUNTUNGAN HARI INI (REAL TIME)
      transactionCount: totalCount,  // ← HANYA PAID DI RANGE FILTER
    },
  };
}