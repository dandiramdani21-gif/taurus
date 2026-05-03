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

  // WHERE condition untuk transaksi (tanpa filter status)
  const transactionWhereCondition = {
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
                    { voucher: { code: { contains: search, mode: "insensitive" as const } } }
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  // WHERE condition untuk keuntungan hari ini
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const todayTransactionWhereCondition = {
    type: "SALE" as const,
    category: category,
    deleted: false,
    createdAt: {
      gte: todayStart,
      lte: todayEnd,
    },
  };

  // ================= EXECUTE QUERIES =================
  const [transactions, todayTransactions] = await Promise.all([
    // Ambil semua transaksi (items include status PAID/REFUND)
    prisma.transaction.findMany({
      where: transactionWhereCondition,
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
    // Ambil transaksi hari ini untuk hitung profit
    prisma.transaction.findMany({
      where: todayTransactionWhereCondition,
      include: {
        items: true,
      },
    }),
  ]);

  // ================= HITUNG SUMMARY DARI ITEMS YANG PAID =================
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalItemCount = 0;

  transactions.forEach((transaction) => {
    transaction.items.forEach((item) => {
      if (item.status === "PAID") {
        const revenue = item.sellPrice * item.quantity;
        const cost = item.costPrice * item.quantity;
        totalRevenue += revenue;
        totalCost += cost;
        totalProfit += revenue - cost;
        totalItemCount += item.quantity;
      }
    });
  });

  // ================= HITUNG KEUNTUNGAN HARI INI (ONLY PAID ITEMS) =================
  let todayProfit = 0;

  todayTransactions.forEach((transaction) => {
    transaction.items.forEach((item) => {
      if (item.status === "PAID") {
        const revenue = item.sellPrice * item.quantity;
        const cost = item.costPrice * item.quantity;
        todayProfit += revenue - cost;
      }
    });
  });

  // ================= DAILY BREAKDOWN (ONLY PAID ITEMS) =================
  const dailyMap = new Map<string, { date: string; revenue: number; cost: number; profit: number }>();

  transactions.forEach((transaction) => {
    const dateStr = transaction.createdAt.toISOString().split("T")[0];
    
    transaction.items.forEach((item) => {
      if (item.status === "PAID") {
        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, { date: dateStr, revenue: 0, cost: 0, profit: 0 });
        }
        const day = dailyMap.get(dateStr)!;
        const revenue = item.sellPrice * item.quantity;
        const cost = item.costPrice * item.quantity;
        day.revenue += revenue;
        day.cost += cost;
        day.profit += revenue - cost;
      }
    });
  });

  const dailySummary = Array.from(dailyMap.values());

  // ================= RETURN =================
  return {
    transactions,  // ← semua items (PAID + REFUND) untuk ditampilkan di UI
    dailySummary,
    summary: {
      totalRevenue,      // ← hanya dari item PAID
      totalCost,         // ← hanya dari item PAID
      totalProfit,       // ← hanya dari item PAID
      todayProfit,       // ← hanya dari item PAID hari ini
      transactionCount: totalItemCount,  // ← jumlah ITEM yang PAID (bukan jumlah transaksi)
    },
  };
}