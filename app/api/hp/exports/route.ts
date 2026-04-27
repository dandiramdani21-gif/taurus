import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeHidden = searchParams.get("includeHidden") === "true";
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const phones = await prisma.phone.findMany({
      where: {
        ...(includeDeleted ? {} : { deleted: false }),
        ...(includeHidden ? {} : { isHidden: false }),
      },
      select: {
        brand: true,
        type: true,
        purchasePrice: true,
        imei: true,
        entryDate: true,
        color: true
      }
    });

    return NextResponse.json(phones);
  } catch (error) {
    console.error("Error fetching phones:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}