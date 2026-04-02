/*
  Warnings:

  - Made the column `code` on table `Phone` required. This step will fail if there are existing NULL values in that column.
  - Made the column `purchaseDate` on table `Phone` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Phone" ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "purchaseDate" SET NOT NULL,
ALTER COLUMN "purchaseDate" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "PhoneMetadata" (
    "id" TEXT NOT NULL,
    "phoneId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneMetadata_phoneId_key_key" ON "PhoneMetadata"("phoneId", "key");

-- AddForeignKey
ALTER TABLE "PhoneMetadata" ADD CONSTRAINT "PhoneMetadata_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "Phone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
