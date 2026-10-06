-- AlterTable
ALTER TABLE "Product" ADD COLUMN "heightCm" INTEGER;

-- AlterTable
ALTER TABLE "ArtistSubmission" ADD COLUMN "isOriginal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ArtistSubmission" ADD COLUMN "widthCm" INTEGER;
ALTER TABLE "ArtistSubmission" ADD COLUMN "heightCm" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "artistPayoutOverheadAmount" INTEGER;
