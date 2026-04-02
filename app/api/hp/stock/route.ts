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

    const phone = await prisma.phone.update({
      where: { id },
      data: { stock },
    });

    return NextResponse.json(phone);
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}