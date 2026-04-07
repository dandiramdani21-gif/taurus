import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, stock } = body;

    if (!id || stock === undefined) {
      return NextResponse.json({ error: "ID dan stok diperlukan" }, { status: 400 });
    }

    const accessory = await prisma.accessory.update({
      where: { id },
      data: { stock: parseInt(stock) },
    });

    return NextResponse.json(accessory);
  } catch (error: any) {
    console.error("Error updating stock:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}