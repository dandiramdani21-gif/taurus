-- Add new enum values for transaction lifecycle and migrate existing data
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
CREATE TYPE "TransactionStatus" AS ENUM ('PAID', 'REFUND');

ALTER TABLE "Transaction"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "TransactionStatus"
  USING (
    CASE
      WHEN "status"::text = 'ACTIVE' THEN 'PAID'::"TransactionStatus"
      ELSE 'REFUND'::"TransactionStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'REFUND';

DROP TYPE "TransactionStatus_old";

-- Track cashier display name at transaction time
ALTER TABLE "Transaction"
ADD COLUMN "servedByName" TEXT;

-- Soft-hide sold/retired HP from kasir/inventory listing
ALTER TABLE "Phone"
ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
