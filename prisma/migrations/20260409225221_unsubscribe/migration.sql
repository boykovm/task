-- CreateEnum
CREATE TYPE "ConfirmationAction" AS ENUM ('SUBSCRIBE', 'UNSUBSCRIBE');

-- AlterTable
ALTER TABLE "Confirmation" ADD COLUMN     "action" "ConfirmationAction" NOT NULL DEFAULT 'SUBSCRIBE';
