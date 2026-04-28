/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category") || "HANDPHONE";
        const startDate = searchParams.get("startDate") || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
        const endDate = searchParams.get("endDate") || new Date().toISOString().split("T")[0];

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        end.setHours(23, 59, 59, 999);

        console.log(startDate, endDate)

        // Ambil semua transaksi PAID dengan category HP
        const transactions = await prisma.transaction.findMany({
            where: {
                type: "SALE",
                category: category as any,
                status: "PAID",
                deleted: false,
                createdAt: { gte: start, lte: end },
            },
            include: {
                items: {
                    include: {
                        phone: {
                            include: {
                                metadata: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        // Transform data
        const reports: any[] = [];
        let totalHPP = 0;
        let totalHPJ = 0;
        let totalRL = 0;

        // Group by date
        const groupedByDate = new Map<string, any[]>();

        transactions.forEach((trx) => {
            trx.items.forEach((item) => {
                if (!item.phone) return;

                const dateKey = trx.createdAt.toISOString().split("T")[0];

                if (!groupedByDate.has(dateKey)) {
                    groupedByDate.set(dateKey, []);
                }

                const beliDari = item.phone.metadata?.find(
                    (m) => /beli\s*dari/i.test(m.key) || /supplier/i.test(m.key) || /asal/i.test(m.key)
                )?.value || "";

                const ketServ = item.phone.metadata?.find(
                    (m) => /ket\s*serv/i.test(m.key) || /service/i.test(m.key) || /catatan/i.test(m.key)
                )?.value || "";

                groupedByDate.get(dateKey)!.push({
                    brand: item.phone.brand,
                    type: item.phone.type,
                    imei: item.phone.imei,
                    color: item.phone.color || "",
                    purchaseDate: item.phone.purchaseDate,
                    beliDari,
                    purchasePrice: item.phone.purchasePrice, // ✅ Dari phone, bukan item.costPrice
                    ketServ,
                    serviceCost: 0,
                    sellDate: trx.createdAt,
                    sellPrice: item.sellPrice, // ✅ Dari item.sellPrice (harga jual)
                    profit: item.sellPrice - item.phone.purchasePrice, // ✅ RL = Jual - Beli
                });
            });
        });

        // Build report per date
        const sortedDates = Array.from(groupedByDate.keys()).sort();

        sortedDates.forEach((date) => {
            const items = groupedByDate.get(date)!;
            const subtotalHPP = items.reduce((sum, i) => sum + i.purchasePrice, 0);
            const subtotalHPJ = items.reduce((sum, i) => sum + i.sellPrice, 0);
            const subtotalRL = items.reduce((sum, i) => sum + i.profit, 0);

            totalHPP += subtotalHPP;
            totalHPJ += subtotalHPJ;
            totalRL += subtotalRL;

            reports.push({
                date,
                items,
                subtotalHPP,
                subtotalHPJ,
                subtotalRL,
            });
        });

        return NextResponse.json({
            reports,
            summary: {
                totalHPP,
                totalHPJ,
                totalRL,
            },
        });
    } catch (error) {
        console.error("Error fetching export laporan:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}