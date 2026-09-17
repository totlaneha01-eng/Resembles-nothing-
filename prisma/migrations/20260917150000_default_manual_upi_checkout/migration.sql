-- Razorpay checkout was disconnected; manual UPI (confirmed by an admin)
-- is now the only checkout path, so new Order rows should default to that
-- instead of "RAZORPAY". Existing rows are untouched — a column default
-- only applies to future inserts that don't specify a value, and the
-- /manual route already sets this explicitly anyway.
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET DEFAULT 'UPI_MANUAL';
