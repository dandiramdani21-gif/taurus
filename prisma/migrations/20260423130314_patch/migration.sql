-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('HANDPHONE', 'PRODUK_LAIN', 'PULSA');

-- CreateEnum
CREATE TYPE "RestockSource" AS ENUM ('MANUAL', 'SCAN', 'IMPORT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Accessory" ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'PRODUK_LAIN';

-- AlterTable
ALTER TABLE "Phone" ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'HANDPHONE';

-- AlterTable
ALTER TABLE "Pulsa" ADD COLUMN     "balance" INTEGER,
ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'PULSA',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "destinationNumber" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'HANDPHONE';

-- AlterTable
ALTER TABLE "TransactionItem" ADD COLUMN     "pulsaBalance" INTEGER,
ADD COLUMN     "pulsaDescription" TEXT,
ADD COLUMN     "pulsaDestinationNumber" TEXT;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "category" "ProductCategory" NOT NULL DEFAULT 'PRODUK_LAIN';

-- CreateTable
CREATE TABLE "RestockNote" (
    "id" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "source" "RestockSource" NOT NULL DEFAULT 'MANUAL',
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "costPrice" INTEGER,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestockNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestockNote_category_productType_idx" ON "RestockNote"("category", "productType");

-- CreateIndex
CREATE INDEX "RestockNote_productId_idx" ON "RestockNote"("productId");

-- CreateIndex
CREATE INDEX "RestockNote_createdAt_idx" ON "RestockNote"("createdAt");

-- AddForeignKey
ALTER TABLE "RestockNote" ADD CONSTRAINT "RestockNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
