// app/api/pulsa/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import type { Prisma } from "@/generated/client";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const deletedParam = searchParams.get("deleted");
    const deleted =
      deletedParam === "true" ? true : deletedParam === "false" || deletedParam === null ? false : undefined;

    const skip = (page - 1) * limit;

    const where = search
      ? {
          ...(deleted === undefined ? {} : { deleted }),
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            { note: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : { ...(deleted === undefined ? {} : { deleted }) };

    const [pulsa, total] = await Promise.all([
      prisma.pulsa.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.pulsa.count({ where }),
    ]);

    return NextResponse.json({
      pulsa,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching pulsa:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Create Pulsa
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code, denomination, costPrice, sellPrice, note, image } = body;

    const existing = await prisma.pulsa.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "Kode pulsa sudah terdaftar" }, { status: 400 });
    }

    const newPulsa = await prisma.pulsa.create({
      data: {
        code,
        denomination: parseInt(denomination),
        costPrice: parseInt(costPrice),
        sellPrice: parseInt(sellPrice),
        note: note || null,
        image: image || null,
      },
    });

    return NextResponse.json(newPulsa, { status: 201 });
  } catch (error) {
    console.error("Error creating pulsa:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT - Update Pulsa
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, code, denomination, costPrice, sellPrice, note, image, deleted } = body;

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    if (code) {
      const existing = await prisma.pulsa.findUnique({ where: { code } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Kode pulsa sudah terdaftar" }, { status: 400 });
      }
    }

    const updateData: Prisma.PulsaUpdateInput = {};
    if (code !== undefined) updateData.code = code;
    if (denomination !== undefined) updateData.denomination = parseInt(denomination);
    if (costPrice !== undefined) updateData.costPrice = parseInt(costPrice);
    if (sellPrice !== undefined) updateData.sellPrice = parseInt(sellPrice);
    if (note !== undefined) updateData.note = note || null;
    if (image !== undefined) updateData.image = image || null;
    if (deleted !== undefined) updateData.deleted = Boolean(deleted);

    const pulsa = await prisma.pulsa.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(pulsa);
  } catch (error: unknown) {
    console.error("Error updating pulsa:", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Pulsa tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    await prisma.pulsa.update({ where: { id }, data: { deleted: true } });

    return NextResponse.json({ message: "Pulsa berhasil diarsipkan" });
  } catch (error: unknown) {
    console.error("Error deleting pulsa:", error);
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Pulsa tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
