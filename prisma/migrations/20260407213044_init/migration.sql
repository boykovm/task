-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_tag" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
