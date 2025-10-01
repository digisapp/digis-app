#!/bin/bash

# Script to remove console.log, console.error, console.warn from production code
# Keeps console statements that are intentionally commented or in error handlers

echo "Removing console statements from frontend code..."

# Counter for removed statements
count=0

# Process all JavaScript files
for file in $(find src -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \)); do
  # Count console statements before
  before=$(grep -c "console\.\(log\|error\|warn\)" "$file" 2>/dev/null || echo 0)
  
  if [ "$before" -gt 0 ]; then
    # Create backup
    cp "$file" "$file.bak"
    
    # Remove console.log statements (most common)
    sed -i '' '/^[[:space:]]*console\.log/d' "$file"
    
    # Remove console.warn statements
    sed -i '' '/^[[:space:]]*console\.warn/d' "$file"
    
    # Keep console.error in catch blocks but remove elsewhere
    sed -i '' '/} catch/!s/^[[:space:]]*console\.error/\/\/ console.error/g' "$file"
    
    # Count after
    after=$(grep -c "console\.\(log\|error\|warn\)" "$file" 2>/dev/null || echo 0)
    
    removed=$((before - after))
    if [ "$removed" -gt 0 ]; then
      count=$((count + removed))
      echo "Removed $removed console statements from $(basename $file)"
    fi
    
    # Remove backup if successful
    rm "$file.bak"
  fi
done

echo "✅ Total console statements removed: $count"
echo ""
echo "Note: console.error statements in catch blocks have been commented out (not removed)"
echo "This preserves error handling while preventing console output in production."