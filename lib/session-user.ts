import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

export async function getValidatedSessionUser(session: Session | null) {
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  return user;
}
