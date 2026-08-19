-- DropIndex
DROP INDEX "CartItem_userId_productId_sizeLabel_key";

-- AlterTable: ArtistSubmission — add the new array column, backfill it from
-- the old single `format` column, then drop the old column. (Doing this in
-- one ADD+DROP would silently null out every existing row's format.)
ALTER TABLE "ArtistSubmission" ADD COLUMN     "formats" "ProductFormat"[];
UPDATE "ArtistSubmission" SET "formats" = ARRAY["format"] WHERE "format" IS NOT NULL;
ALTER TABLE "ArtistSubmission" ADD COLUMN     "editionSize" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ArtistSubmission" DROP COLUMN "format";

-- AlterTable: Product — same backfill pattern; this table has real seeded
-- rows in production, so losing `format` here would be a real regression.
ALTER TABLE "Product" ADD COLUMN     "formats" "ProductFormat"[];
UPDATE "Product" SET "formats" = ARRAY["format"] WHERE "format" IS NOT NULL;
ALTER TABLE "Product" ADD COLUMN     "editionSize" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN     "unitsSold" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" DROP COLUMN "format";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "format" "ProductFormat" NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "format" "ProductFormat" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_format_sizeLabel_key" ON "CartItem"("userId", "productId", "format", "sizeLabel");
