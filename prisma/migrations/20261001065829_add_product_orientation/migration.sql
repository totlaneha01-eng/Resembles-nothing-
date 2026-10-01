-- CreateEnum
CREATE TYPE "ProductOrientation" AS ENUM ('PORTRAIT', 'LANDSCAPE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "orientation" "ProductOrientation" NOT NULL DEFAULT 'PORTRAIT';
