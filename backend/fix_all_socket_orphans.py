#!/usr/bin/env python3
"""
Fix ALL orphaned JavaScript object properties from commented-out socket.io calls
This script handles the pattern where io.to().emit() is commented but the object properties are not
"""

import os
import re

def fix_file(filepath):
    """Fix a single file by finding and commenting orphaned properties"""
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content

    # Pattern: commented io.to().emit( followed by uncommented properties
    # Look for: //       io.to(...).emit(..., {
    # followed by lines with properties that should be commented

    lines = content.split('\n')
    modified = False
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this is a commented io.to().emit() line ending with {
        if re.search(r'//\s+(io\.to\(.*\)\.emit\(.*,\s*\{)\s*$', line):
            # Found a commented emit with opening brace
            # Now find the matching closing brace and comment everything in between
            j = i + 1
            brace_count = 1
            properties_to_comment = []

            while j < len(lines) and brace_count > 0:
                next_line = lines[j]
                stripped = next_line.strip()

                # Count braces
                if '{' in stripped:
                    brace_count += stripped.count('{')
                if '}' in stripped:
                    brace_count -= stripped.count('}')

                # If not already commented and contains content, mark for commenting
                if not stripped.startswith('//') and stripped and brace_count > 0:
                    properties_to_comment.append(j)

                # If we've found the closing brace for the object
                if brace_count == 0:
                    # Check if this closing line needs commenting
                    if not stripped.startswith('//') and '}' in stripped:
                        properties_to_comment.append(j)
                    break

                j += 1

            # Comment out all the property lines
            for line_num in properties_to_comment:
                indent = len(lines[line_num]) - len(lines[line_num].lstrip())
                lines[line_num] = ' ' * indent + '// ' + lines[line_num].lstrip()
                modified = True

        i += 1

    if modified:
        new_content = '\n'.join(lines)
        with open(filepath, 'w') as f:
            f.write(new_content)
        return True
    return False

# Find all JavaScript files in backend (excluding node_modules)
fixed_files = []
for root, dirs, files in os.walk('.'):
    # Skip node_modules
    dirs[:] = [d for d in dirs if d != 'node_modules']

    for file in files:
        if file.endswith('.js'):
            filepath = os.path.join(root, file)
            if fix_file(filepath):
                fixed_files.append(filepath)
                print(f"Fixed: {filepath}")

if fixed_files:
    print(f"\nTotal files fixed: {len(fixed_files)}")
else:
    print("No files needed fixing")
