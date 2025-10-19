#!/bin/bash
# Test migration 015: Fix function search_path security

set -e

echo "🔍 Testing migration 015_fix_function_search_path_security.sql..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  # Try to read from .env file
  if [ -f .env ]; then
    export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  fi

  if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set"
    echo "Set it in .env or run: export DATABASE_URL='your-connection-string'"
    exit 1
  fi
fi

echo "✅ DATABASE_URL found"

# Run the migration
echo "📝 Applying migration..."
psql "$DATABASE_URL" -f migrations/015_fix_function_search_path_security.sql

echo ""
echo "✅ Migration applied successfully!"
echo ""
echo "📊 Verifying function configurations..."
echo ""

# Verify search_path is set
psql "$DATABASE_URL" -c "
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as configuration
FROM pg_proc
WHERE proname IN ('cached_auth_uid', 'get_current_user_db_id')
  AND pronamespace = 'public'::regnamespace;
"

echo ""
echo "✅ Verification complete!"
echo ""
echo "Expected: Both functions should show configuration = {search_path=public}"
echo ""
echo "Next steps:"
echo "1. Re-run Supabase Database Linter to confirm warnings resolved"
echo "2. Test your app to ensure functions still work correctly"
echo "3. Address remaining security warnings (see README)"
