import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client";

const isProduction = process.env.NODE_ENV === "production";
const isLocal = process.env.NODE_ENV === "development";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

let prisma: PrismaClient;

if (isProduction || isLocal) {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  prisma = new PrismaClient({ adapter });
} else {
  throw new Error(`Unsupported NODE_ENV: ${process.env.NODE_ENV}`);
}

export { prisma };