/*
  Warnings:

  - A unique constraint covering the columns `[email,repo]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Subscription_email_repo_key" ON "Subscription"("email", "repo");
