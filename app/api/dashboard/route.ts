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
    const transactionPage = parseInt(searchParams.get("transactionPage") || "1");
    const transactionLimit = parseInt(searchParams.get("transactionLimit") || "5");
    const productPage = parseInt(searchParams.get("productPage") || "1");
    const productLimit = parseInt(searchParams.get("productLimit") || "5");

    const transactionSkip = (transactionPage - 1) * transactionLimit;
    const productSkip = (productPage - 1) * productLimit;

    // Total pendapatan & keuntungan
    const transactions = await prisma.transaction.findMany({
      where: { status: "ACTIVE" },
      select: { totalAmount: true, profit: true },
    });

    const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalProfit = transactions.reduce((sum, t) => sum + t.profit, 0);
    const totalTransactions = transactions.length;

    // Total produk dari Product dan Phone
    const [totalProducts, totalPhones] = await Promise.all([
      prisma.product.count(),
      prisma.phone.count(),
    ]);
    const totalAllProducts = totalProducts + totalPhones;

    // Transaksi terbaru dengan pagination
    const recentTransactions = await prisma.transaction.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      skip: transactionSkip,
      take: transactionLimit,
      include: {
        user: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, code: true } },
            phone: { select: { brand: true, type: true, code: true } },
          },
        },
      },
    });

    const totalTransactionsCount = await prisma.transaction.count({
      where: { status: "ACTIVE" },
    });

    // Daily sales (7 hari terakhir)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailySalesRaw = await prisma.transaction.groupBy({
      by: ["createdAt"],
      where: {
        status: "ACTIVE",
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: { totalAmount: true },
    });

    const dailySalesMap = new Map();
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailySalesMap.set(dateStr, 0);
    }

    dailySalesRaw.forEach((item) => {
      const dateStr = item.createdAt.toISOString().split("T")[0];
      dailySalesMap.set(dateStr, (dailySalesMap.get(dateStr) || 0) + (item._sum.totalAmount || 0));
    });

    const dailySales = Array.from(dailySalesMap.entries()).map(([date, total]) => ({
      date: date.slice(5),
      total,
    }));

    // Top 5 produk terlaris dari TransactionItem (Product)
    const topProductsRaw = await prisma.transactionItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    const topProducts = await Promise.all(
      topProductsRaw.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId! },
          select: { name: true, code: true },
        });
        return {
          name: product?.name || "Unknown",
          code: product?.code || "-",
          sold: item._sum.quantity || 0,
        };
      })
    );

    // Top HP terlaris dari TransactionItem (Phone)
    const topPhonesRaw = await prisma.transactionItem.groupBy({
      by: ["phoneId"],
      where: { phoneId: { not: null } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    const topPhones = await Promise.all(
      topPhonesRaw.map(async (item) => {
        const phone = await prisma.phone.findUnique({
          where: { id: item.phoneId! },
          select: { brand: true, type: true, code: true },
        });
        return {
          name: phone ? `${phone.brand} ${phone.type}` : "Unknown",
          code: phone?.code || "-",
          sold: item._sum.quantity || 0,
        };
      })
    );

    // Gabungkan semua produk terlaris
    const allTopProducts = [...topProducts, ...topPhones]
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    // Stok menipis dari Product (kurang dari 5)
    const lowStockProducts = await prisma.product.findMany({
      where: { stock: { lt: 5, gt: 0 } },
      select: { name: true, code: true, stock: true },
      orderBy: { stock: "asc" },
    });

    // Stok menipis dari Phone (kurang dari 3 karena biasanya stok HP 1)
    const lowStockPhones = await prisma.phone.findMany({
      where: { stock: { lt: 3, gt: 0 } },
      select: { brand: true, type: true, code: true, stock: true },
      orderBy: { stock: "asc" },
    });

    const lowStockItems = [
      ...lowStockProducts.map(p => ({ name: p.name, code: p.code, stock: p.stock, type: "Product" })),
      ...lowStockPhones.map(p => ({ name: `${p.brand} ${p.type}`, code: p.code, stock: p.stock, type: "Phone" })),
    ].sort((a, b) => a.stock - b.stock);

    return NextResponse.json({
      totalRevenue,
      totalProfit,
      totalTransactions,
      totalProducts: totalAllProducts,
      recentTransactions: {
        data: recentTransactions,
        pagination: {
          page: transactionPage,
          limit: transactionLimit,
          total: totalTransactionsCount,
          totalPages: Math.ceil(totalTransactionsCount / transactionLimit),
        },
      },
      dailySales,
      topProducts: allTopProducts,
      stockAlerts: lowStockItems,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}