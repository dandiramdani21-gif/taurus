import { prisma } from "@/lib/prisma";
import type { ProductCategory } from "@/generated/client";

type GetLaporanParams = {
  startDate: string;
  endDate: string;
  category: ProductCategory;
  search: string | null;
  page?: number;
  pageSize?: number;
};

export async function getCategoryLaporan({
  startDate,
  endDate,
  category,
  search,
  page = 1,
  pageSize = 6,
}: GetLaporanParams) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const skip = (page - 1) * pageSize;

  const whereCondition = {
    type: "SALE" as const,
    category,
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

  // ✅ Summary condition: hanya PAID
  const summaryWhereCondition = {
    ...whereCondition,
    status: "PAID" as const,
  };

  // ✅ Today's date range
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const todayWhereCondition = {
    type: "SALE" as const,
    category,
    deleted: false,
    status: "PAID" as const,
    createdAt: {
      gte: todayStart,
      lte: todayEnd,
    },
  };

  const [totalCount, transactions, aggregateResult, todayAggregate] = await Promise.all([
    prisma.transaction.count({ where: whereCondition }),
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
      skip,
      take: pageSize,
    }),
    prisma.transaction.aggregate({
      where: summaryWhereCondition, // ✅ Hanya PAID
      _sum: {
        totalAmount: true,
        totalCost: true,
        profit: true,
      },
    }),
    prisma.transaction.aggregate({
      where: todayWhereCondition,
      _sum: {
        profit: true,
      },
    }),
  ]);

  const totalRevenue = aggregateResult._sum.totalAmount || 0;
  const totalCost = aggregateResult._sum.totalCost || 0;
  const totalProfit = aggregateResult._sum.profit || 0;
  const todayProfit = todayAggregate._sum.profit || 0;

  const dailyMap = new Map<string, { date: string; revenue: number; cost: number; profit: number }>();

  transactions.forEach((transaction) => {
    const dateStr = transaction.createdAt.toISOString().split("T")[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { date: dateStr, revenue: 0, cost: 0, profit: 0 });
    }

    const day = dailyMap.get(dateStr)!;
    const multiplier = transaction.status === "REFUND" ? 0 : 1;
    day.revenue += transaction.totalAmount * multiplier;
    day.cost += transaction.totalCost * multiplier;
    day.profit += transaction.profit * multiplier;
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    transactions,
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      todayProfit,
      transactionCount: totalCount,
    },
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}