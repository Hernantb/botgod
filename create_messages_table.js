import fetch from 'node-fetch'

const SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI'

async function createMessagesTable() {
  try {
    console.log('Creating messages table...')

    const sql = `
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
    `

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        sql_query: sql
      })
    })

    const result = await response.json()
    console.log('Response:', result)

    if (!response.ok) {
      console.error('Error creating table:', result)
      return
    }

    console.log('Table created successfully!')

  } catch (error) {
    console.error('Error:', error)
  }
}

createMessagesTable() 