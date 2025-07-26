-- Comprehensive fix for Conversation table constraints
-- This will completely fix the unique constraint issues

-- Step 1: Find and drop ALL unique constraints on whatsappChatId
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find all unique constraints that involve whatsappChatId
    FOR constraint_record IN 
        SELECT conname, conrelid::regclass as table_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        WHERE c.conrelid = 'Conversations'::regclass 
        AND c.contype = 'u' 
        AND a.attname = 'whatsappChatId'
    LOOP
        EXECUTE 'ALTER TABLE ' || constraint_record.table_name || ' DROP CONSTRAINT ' || quote_ident(constraint_record.conname);
        RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
    END LOOP;
END $$;

-- Step 2: Also drop any indexes that might be causing issues
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key1";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key2";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key3";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key4";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key5";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key6";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key7";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key8";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key9";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key10";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key11";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key12";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key13";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key14";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key15";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key16";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key17";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key18";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key19";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key20";
DROP INDEX IF EXISTS "Conversations_whatsappChatId_key21";

-- Step 3: Create the correct composite unique constraint
ALTER TABLE "Conversations" 
ADD CONSTRAINT "conversations_chatid_owner_unique" 
UNIQUE ("whatsappChatId", "ownerId");

-- Step 4: Add performance indexes
CREATE INDEX IF NOT EXISTS "idx_conversations_owner_chat" 
ON "Conversations" ("ownerId", "whatsappChatId");

CREATE INDEX IF NOT EXISTS "idx_conversations_chatid" 
ON "Conversations" ("whatsappChatId");

-- Step 5: Clean up any duplicate conversations that might exist
-- This will keep the oldest conversation for each (whatsappChatId, ownerId) pair
DELETE FROM "Conversations" 
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY "whatsappChatId", "ownerId" 
                   ORDER BY "createdAt" ASC
               ) as rn
        FROM "Conversations"
    ) t 
    WHERE t.rn > 1
);

-- Step 6: Verify the changes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'Conversations'
ORDER BY indexname;

-- Show remaining constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    string_agg(a.attname, ', ' ORDER BY a.attnum) as columns
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.conrelid = 'Conversations'::regclass 
AND c.contype IN ('u', 'p')
GROUP BY conname, contype
ORDER BY conname; 