#!/usr/bin/env python3
"""
Fix orphaned JavaScript object properties from commented-out io.to().emit() calls
"""

import re
import glob

def fix_file(filepath):
    """Fix a single file by commenting out orphaned object properties after io.to() calls"""
    with open(filepath, 'r') as f:
        lines = f.readlines()

    modified = False
    i = 0
    while i < len(lines):
        line = lines[i]

        # Check if this is a commented io.to().emit() line
        if '//     io.to(' in line or '//   io.to(' in line:
            # Check if the next lines have uncommented object properties
            j = i + 1
            while j < len(lines):
                next_line = lines[j]
                stripped = next_line.strip()

                # Stop if we hit a closing brace that ends the block
                if stripped == '});':
                    # Comment this line too
                    indent = len(next_line) - len(next_line.lstrip())
                    lines[j] = ' ' * indent + '// ' + next_line.lstrip()
                    modified = True
                    break

                # Stop if we hit an empty line or new statement
                if not stripped or stripped.startswith('//') or stripped.startswith('res.') or stripped.startswith('await') or stripped.startswith('const') or stripped.startswith('let') or stripped.startswith('var'):
                    break

                # This is an uncommented line that should be commented
                if ':' in stripped or stripped == '}' or stripped.endswith(','):
                    indent = len(next_line) - len(next_line.lstrip())
                    lines[j] = ' ' * indent + '// ' + next_line.lstrip()
                    modified = True

                j += 1

        i += 1

    if modified:
        with open(filepath, 'w') as f:
            f.writelines(lines)
        return True
    return False

# Fix all route files and utils files
fixed_files = []
for pattern in ['routes/*.js', 'utils/*.js']:
    for filepath in glob.glob(pattern):
        if fix_file(filepath):
            fixed_files.append(filepath)
            print(f"Fixed: {filepath}")

if fixed_files:
    print(f"\nTotal files fixed: {len(fixed_files)}")
else:
    print("No files needed fixing")
