-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "dni" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Client_isActive_idx" ON "Client"("isActive");
