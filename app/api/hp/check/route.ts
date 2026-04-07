import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }

    const phone = await prisma.phone.findUnique({
      where: { code },
      select: { id: true, code: true, brand: true, type: true, stock: true },
    });

    return NextResponse.json({ exists: !!phone, phone });
  } catch (error) {
    console.error("Error checking code:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}