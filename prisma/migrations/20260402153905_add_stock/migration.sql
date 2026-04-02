/*
  Warnings:

  - You are about to drop the column `isSold` on the `Phone` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Phone" DROP COLUMN "isSold",
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 1;
