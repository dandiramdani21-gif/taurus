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

  // Get total count for pagination
  const totalCount = await prisma.transaction.count({
    where: {
      type: "SALE",
      category,
      deleted: false,
      createdAt: {
        gte: start,
        lte: end,
      },
      ...(search
        ? {
            items: {
              some: {
                OR: [
                  {
                    phone: {
                      imei: {
                        equals: search,
                        mode: "insensitive",
                      },
                    },
                  },
                  { accessory: { name: { contains: search, mode: "insensitive" } } },
                  { pulsa: { description: { contains: search, mode: "insensitive" } } },
                ],
              },
            },
          }
        : {}),
    },
  });

  const transactions = await prisma.transaction.findMany({
    where: {
      type: "SALE",
      category,
      deleted: false,
      createdAt: {
        gte: start,
        lte: end,
      },
      ...(search
        ? {
            items: {
              some: {
                OR: [
                  {
                    phone: {
                      imei: {
                        equals: search,
                        mode: "insensitive",
                      },
                    },
                  },
                  { accessory: { name: { contains: search, mode: "insensitive" } } },
                  { pulsa: { description: { contains: search, mode: "insensitive" } } },
                ],
              },
            },
          }
        : {}),
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
    skip,
    take: pageSize,
  });

  const totalRevenue = transactions.reduce(
    (sum, transaction) => sum + (transaction.status === "REFUND" ? 0 : transaction.totalAmount),
    0
  );
  const totalCost = transactions.reduce(
    (sum, transaction) => sum + (transaction.status === "REFUND" ? 0 : transaction.totalCost),
    0
  );
  const totalProfit = transactions.reduce(
    (sum, transaction) => sum + (transaction.status === "REFUND" ? 0 : transaction.profit),
    0
  );

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

  const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    transactions,
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      transactionCount: transactions.length,
    },
    chartData,
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
