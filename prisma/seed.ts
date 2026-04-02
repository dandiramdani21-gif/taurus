import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting seeding...");

  // Cek apakah user sudah ada
  const existingUser = await prisma.user.findUnique({
    where: { email: "admin@example.com" }
  });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    await prisma.user.create({
      data: {
        name: "Admin",
        email: "admin@example.com",
        password: hashedPassword,
      },
    });
    
    console.log("✅ User admin created:");
    console.log("   Email: admin@example.com");
    console.log("   Password: admin123");
  } else {
    console.log("⚠️  User already exists, skipping...");
  }

  console.log("🌱 Seeding finished!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });