-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for users based on business_id" ON "public"."messages";
DROP POLICY IF EXISTS "Enable insert for users based on business_id" ON "public"."messages";
DROP POLICY IF EXISTS "Enable update for users based on business_id" ON "public"."messages";

-- Drop the table if it exists
DROP TABLE IF EXISTS "public"."messages";

-- Create the messages table
CREATE TABLE "public"."messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "conversation_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "sender_type" VARCHAR CHECK (sender_type IN ('user', 'bot')) NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "read" BOOLEAN DEFAULT false NOT NULL,
    "business_id" UUID NOT NULL,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE,
    CONSTRAINT "messages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX "messages_conversation_id_idx" ON "public"."messages" ("conversation_id");
CREATE INDEX "messages_business_id_idx" ON "public"."messages" ("business_id");
CREATE INDEX "messages_created_at_idx" ON "public"."messages" ("created_at");

-- Enable Row Level Security
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for users based on business_id" ON "public"."messages"
AS PERMISSIVE FOR SELECT
TO public
USING (
    business_id IN (
        SELECT business_id 
        FROM business_users 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Enable insert for users based on business_id" ON "public"."messages"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (
    business_id IN (
        SELECT business_id 
        FROM business_users 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Enable update for users based on business_id" ON "public"."messages"
AS PERMISSIVE FOR UPDATE
TO public
USING (
    business_id IN (
        SELECT business_id 
        FROM business_users 
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id 
        FROM business_users 
        WHERE user_id = auth.uid()
    )
); 