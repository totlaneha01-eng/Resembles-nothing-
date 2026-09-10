-- CreateTable
CREATE TABLE "DesignRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "contact" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DesignRequest" ADD CONSTRAINT "DesignRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
