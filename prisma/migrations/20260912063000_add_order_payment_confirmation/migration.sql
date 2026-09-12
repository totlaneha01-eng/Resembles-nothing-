-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'RAZORPAY',
ADD COLUMN     "paymentConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentConfirmedAt" TIMESTAMP(3);
