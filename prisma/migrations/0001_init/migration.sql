-- CreateTable
CREATE TABLE "links" (
    "id" BIGSERIAL NOT NULL,
    "short_code" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "custom_alias" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clicks" (
    "id" BIGSERIAL NOT NULL,
    "link_id" BIGINT NOT NULL,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer" TEXT,
    "user_agent" TEXT,
    "ip_country" TEXT NOT NULL DEFAULT 'XX',

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "links_short_code_key" ON "links"("short_code");

-- CreateIndex
CREATE INDEX "links_expires_at_idx" ON "links"("expires_at");

-- CreateIndex
CREATE INDEX "clicks_link_id_clicked_at_idx" ON "clicks"("link_id", "clicked_at");

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
