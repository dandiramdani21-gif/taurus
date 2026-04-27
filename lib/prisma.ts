import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const isProduction = process.env.NODE_ENV === 'production';
const isLocal = process.env.NODE_ENV === 'development';

let prisma: PrismaClient; // Remove 'any' typing

if (isProduction) {
  // Production: Tetap pake generated client tapi dengan Accelerate
  const baseClient = new PrismaClient({
    accelerateUrl: process.env.ACCELERATE_DATABASE_URL as string,
  });
  prisma = baseClient.$extends(withAccelerate()) as unknown as PrismaClient;
  
} else if (isLocal) {
  // Local: Pakai adapter
  const adapter = new PrismaPg({ 
    connectionString: process.env.DATABASE_URL 
  });
  prisma = new PrismaClient({ adapter });
  
} else {
  throw new Error(`Unsupported NODE_ENV: ${process.env.NODE_ENV}`);
}

export { prisma };