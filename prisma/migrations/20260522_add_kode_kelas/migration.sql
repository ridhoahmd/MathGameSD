-- AlterTable: tambah kolom kodeKelas ke GameQuestion
ALTER TABLE "GameQuestion" ADD COLUMN "kodeKelas" TEXT;

-- CreateIndex: index untuk query soal kelas spesifik
CREATE INDEX "GameQuestion_category_level_kodeKelas_idx" ON "GameQuestion"("category", "level", "kodeKelas");
