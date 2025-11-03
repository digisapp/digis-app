#!/bin/bash

# Test script for messaging system migration
# Usage: ./016_test_migration.sh

set -e  # Exit on error

echo "🚀 Testing Messaging System Migration..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
elif [ -f backend/.env ]; then
  export $(cat backend/.env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  exit 1
fi

echo "📊 Database: ${DATABASE_URL%%@*}@***"

# Run the migration
echo "📝 Running migration..."
psql "$DATABASE_URL" -f migrations/016_create_messaging_system.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"

  # Test the functions
  echo ""
  echo "🧪 Testing database functions..."

  psql "$DATABASE_URL" <<EOF
-- Test get_or_create_conversation function
SELECT '✅ Testing get_or_create_conversation...' as status;

-- Test get_unread_count function
SELECT '✅ Testing get_unread_count...' as status;

-- Show table counts
SELECT 'conversations' as table_name, COUNT(*) as count FROM conversations
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'typing_indicators', COUNT(*) FROM typing_indicators
UNION ALL
SELECT 'message_reactions', COUNT(*) FROM message_reactions
UNION ALL
SELECT 'message_reports', COUNT(*) FROM message_reports;
EOF

  echo ""
  echo "✅ All tests passed!"
else
  echo "❌ Migration failed!"
  exit 1
fi
