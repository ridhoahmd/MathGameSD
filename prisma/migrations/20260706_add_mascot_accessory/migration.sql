-- AlterTable: Add equippedMascot and equippedAccessory to User
ALTER TABLE "User" ADD COLUMN "equippedMascot" TEXT;
ALTER TABLE "User" ADD COLUMN "equippedAccessory" TEXT;
