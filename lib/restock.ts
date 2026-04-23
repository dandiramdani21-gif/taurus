import { prisma } from "@/lib/prisma";
import { ProductCategory, RestockSource } from "@/generated/client";

export type RestockInput = {
  category: ProductCategory;
  productType: string;
  productId: string;
  productName: string;
  source?: RestockSource;
  quantity: number;
  previousStock: number;
  newStock: number;
  costPrice?: number | null;
  note?: string | null;
  userId?: string | null;
};

export async function logRestock(input: RestockInput) {
  const data: Parameters<typeof prisma.restockNote.create>[0]["data"] = {
    category: input.category,
    productType: input.productType,
    productId: input.productId,
    productName: input.productName,
    source: input.source ?? RestockSource.MANUAL,
    quantity: input.quantity,
    previousStock: input.previousStock,
    newStock: input.newStock,
    costPrice: input.costPrice ?? null,
    note: input.note ?? null,
  };

  if (input.userId) {
    const userExists = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });

    if (userExists) {
      data.userId = input.userId;
    }
  }

  try {
    return await prisma.restockNote.create({ data });
  } catch (error) {
    console.error("Failed to write restock note:", error);
    return null;
  }
}
