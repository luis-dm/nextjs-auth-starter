/*
  Warnings:

  - You are about to drop the column `fragmentData` on the `Facility` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Facility" DROP COLUMN "fragmentData",
ADD COLUMN     "fragmentPath" TEXT;
