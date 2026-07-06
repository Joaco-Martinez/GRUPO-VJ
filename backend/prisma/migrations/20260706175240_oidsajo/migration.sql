-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isVisibleToPublic" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Product_isVisibleToPublic_idx" ON "Product"("isVisibleToPublic");
