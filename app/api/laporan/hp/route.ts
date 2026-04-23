import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getCategoryLaporan } from "@/lib/laporan";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Tanggal mulai dan akhir diperlukan" }, { status: 400 });
    }

    const data = await getCategoryLaporan({
      startDate,
      endDate,
      category: "HANDPHONE",
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching laporan handphone:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
