-- Push device tokens (Expo) and global push opt-out on notification settings.

CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_tokens_user_id_platform_key" ON "push_tokens"("user_id", "platform");
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_settings" ADD COLUMN "push_enabled" BOOLEAN NOT NULL DEFAULT true;
