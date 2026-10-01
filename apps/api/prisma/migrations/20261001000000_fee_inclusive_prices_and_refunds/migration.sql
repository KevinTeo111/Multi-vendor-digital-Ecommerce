-- Seller's own price; Product.priceCents becomes the listed price (seller price + provider fee).
-- Nullable so code deployed before this migration keeps inserting products.
ALTER TABLE "Product" ADD COLUMN "basePriceCents" INTEGER;
UPDATE "Product" SET "basePriceCents" = "priceCents";

-- Provider fee reserve frozen on each sold item (listed price - seller price).
ALTER TABLE "OrderItem" ADD COLUMN "gatewayFeeCents" INTEGER NOT NULL DEFAULT 0;

-- Refunds and chargebacks.
ALTER TABLE "Order" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "refundReason" TEXT;
