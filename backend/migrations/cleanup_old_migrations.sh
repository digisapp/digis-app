#!/bin/bash

# =====================================================
# CLEANUP OLD MIGRATIONS SCRIPT
# =====================================================
# This script removes duplicate and Firebase-related migration files
# Run this AFTER backing up your migrations directory

echo "Migration Cleanup Script"
echo "======================="
echo ""

# Check if we're in the correct directory
if [ ! -d "migrations" ]; then
    echo "Error: migrations directory not found"
    echo "Please run this script from the backend directory"
    exit 1
fi

# Create backup directory
BACKUP_DIR="migrations_backup_$(date +%Y%m%d_%H%M%S)"
echo "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup all migrations
echo "Backing up all migration files..."
cp -r migrations/* "$BACKUP_DIR/"
echo "Backup complete"
echo ""

# List of files to remove (duplicates and deprecated)
FILES_TO_REMOVE=(
    "migrations/003_create_classes_tables.sql"  # Superseded by 005
    "migrations/004_create_call_requests.sql"   # Superseded by 005
    "migrations/004_supabase_auth_migration.sql" # Already applied in main migration
    "migrations/007_remove_firebase_columns.sql" # Included in main migration
    "migrations/migrate-firebase-to-supabase.js" # Old Firebase migration
    "migrations/migrate-remaining-firebase.js"   # Old Firebase migration
    "migrations/complete-firebase-removal.js"    # Old Firebase migration
    "migrations/final-firebase-cleanup.js"       # Old Firebase migration
    "migrations/verify-firebase-removal.js"      # Old Firebase migration
)

echo "Files to be removed:"
echo "==================="
for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file (not found)"
    fi
done
echo ""

# Ask for confirmation
read -p "Do you want to proceed with removing these files? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled"
    exit 0
fi

# Remove the files
echo ""
echo "Removing files..."
for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "Removed: $file"
    fi
done

# Rename remaining migrations to have consistent numbering
echo ""
echo "Reorganizing remaining migrations..."

# Create a temporary directory for reorganized files
TEMP_DIR="migrations_temp"
mkdir -p "$TEMP_DIR"

# Copy the new Supabase migration files
cp migrations/099_pre_migration_validation.sql "$TEMP_DIR/"
cp migrations/100_complete_supabase_migration.sql "$TEMP_DIR/"
cp migrations/101_complete_rls_policies.sql "$TEMP_DIR/"
cp migrations/102_add_partitioning_and_fix_fkeys.sql "$TEMP_DIR/"
cp migrations/103_rollback_supabase_migration.sql "$TEMP_DIR/"

# Copy other non-duplicate migrations in order
COUNTER=1
for file in migrations/*.sql; do
    filename=$(basename "$file")
    
    # Skip if it's one of our new migrations or a file to remove
    if [[ "$filename" =~ ^(099|100|101|102|103)_ ]]; then
        continue
    fi
    
    skip=0
    for remove_file in "${FILES_TO_REMOVE[@]}"; do
        if [[ "$file" == "$remove_file" ]]; then
            skip=1
            break
        fi
    done
    
    if [ $skip -eq 1 ]; then
        continue
    fi
    
    # Copy with new number
    new_filename=$(printf "%03d" $COUNTER)_${filename#*_}
    cp "$file" "$TEMP_DIR/$new_filename"
    echo "Renamed: $filename -> $new_filename"
    COUNTER=$((COUNTER + 1))
done

# Move Supabase migrations to the end
SUPABASE_START=$COUNTER
for file in 099_pre_migration_validation.sql 100_complete_supabase_migration.sql 101_complete_rls_policies.sql 102_add_partitioning_and_fix_fkeys.sql 103_rollback_supabase_migration.sql; do
    if [ -f "$TEMP_DIR/$file" ]; then
        new_filename=$(printf "%03d" $COUNTER)_${file#*_}
        mv "$TEMP_DIR/$file" "$TEMP_DIR/$new_filename"
        echo "Renumbered: $file -> $new_filename"
        COUNTER=$((COUNTER + 1))
    fi
done

# Replace migrations directory with cleaned version
echo ""
echo "Finalizing cleanup..."
rm -rf migrations
mv "$TEMP_DIR" migrations

echo ""
echo "Cleanup complete!"
echo "================"
echo "Backup saved in: $BACKUP_DIR"
echo "Supabase migrations start at: $(printf "%03d" $SUPABASE_START)"
echo ""
echo "Next steps:"
echo "1. Review the cleaned migrations directory"
echo "2. Update your migration runner to exclude completed migrations"
echo "3. Run the Supabase migration following SUPABASE_MIGRATION_GUIDE.md"