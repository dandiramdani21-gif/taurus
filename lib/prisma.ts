// import "dotenv/config";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { PrismaClient } from '@/generated/client'
// import { withAccelerate } from '@prisma/extension-accelerate'
// const connectionString = `${process.env.DATABASE_URL}`;

// const adapter = new PrismaPg({ connectionString });
// const prisma = new PrismaClient({adapter}).$extends(withAccelerate())

// export {prisma}


import { PrismaClient } from "@/generated/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

export {prisma}