/*
  Warnings:

  - You are about to drop the column `code` on the `Phone` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Phone_code_key";

-- AlterTable
ALTER TABLE "Phone" DROP COLUMN "code";
