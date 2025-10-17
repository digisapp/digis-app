#!/usr/bin/env python3
"""
Migrate all commented Socket.io calls to Ably publish calls
"""

import os
import re

# Files to migrate
FILES_TO_MIGRATE = [
    'routes/live-shopping.js',
    'routes/shop.js',
    'routes/loyalty.js',
    'routes/stream-features.js',
    'routes/polls.js',
    'routes/streaming.js',
    'routes/ticketed-shows.js',
    'routes/recording.js',
    'routes/stream-chat.js',
    'routes/questions.js',
    'routes/goals.js',
    'utils/challenge-service.js',
    'utils/stream-activity-monitor.js',
    'utils/loyalty-service.js',
    'routes/enhanced-subscriptions.js',
    'routes/tokens.js'
]

def add_ably_import(filepath):
    """Add Ably import if not already present"""
    with open(filepath, 'r') as f:
        content = f.read()

    # Check if already imported
    if 'ably-adapter' in content or 'ably-publish' in content:
        return False

    # Find the last require() statement in the file
    lines = content.split('\n')
    last_require_index = -1

    for i, line in enumerate(lines):
        if 'require(' in line and not line.strip().startswith('//'):
            last_require_index = i

    if last_require_index == -1:
        # No requires found, add at the top after any comments
        for i, line in enumerate(lines):
            if not line.strip().startswith('//') and not line.strip().startswith('/*') and not line.strip().startswith('*') and line.strip():
                last_require_index = i - 1
                break

    # Insert the import
    import_line = "const { publishToChannel } = require('../utils/ably-adapter');"
    if filepath.startswith('utils/'):
        import_line = "const { publishToChannel } = require('./ably-adapter');"

    lines.insert(last_require_index + 1, import_line)

    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))

    return True

def migrate_socket_to_ably(filepath):
    """Convert commented Socket.io calls to Ably publish calls"""
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    lines = content.split('\n')
    modified = False
    i = 0

    while i < len(lines):
        line = lines[i]

        # Look for TODO comment followed by commented io.to() call
        if '// TODO: Replace with Ably' in line:
            # Check if next line(s) contain commented io.to().emit()
            j = i + 1

            # Find the commented io.to().emit() line
            while j < len(lines):
                next_line = lines[j]
                stripped = next_line.strip()

                # Found the commented io.to() call
                if stripped.startswith('//') and 'io.to(' in stripped and '.emit(' in stripped:
                    # Extract channel and event name
                    # Pattern: //   io.to('channel').emit('event', {
                    # or:      //   io.to(`user:${userId}`).emit('event', {
                    match = re.search(r"io\.to\(['\"`]([^'\"`\)]+)['\"`\)]\.emit\(['\"`]([^'\"`]+)['\"`]", stripped)
                    if not match:
                        # Try template literal pattern
                        match = re.search(r'io\.to\(`([^`]+)`\)\.emit\([\'"`]([^\'"`]+)[\'"`]', stripped)

                    if match:
                        channel = match.group(1)
                        event = match.group(2)

                        # Find all the commented property lines
                        k = j + 1
                        properties = []
                        brace_count = 1

                        while k < len(lines) and brace_count > 0:
                            prop_line = lines[k]
                            prop_stripped = prop_line.strip()

                            # Skip if already uncommented (shouldn't happen)
                            if not prop_stripped.startswith('//'):
                                k += 1
                                continue

                            # Remove comment prefix
                            uncommented = prop_stripped[2:].strip()

                            # Count braces
                            if '{' in uncommented:
                                brace_count += uncommented.count('{')
                            if '}' in uncommented:
                                brace_count -= uncommented.count('}')

                            # Extract property content
                            if uncommented and brace_count > 0 and uncommented != '}' and uncommented != '});':
                                # Get the indentation from original line
                                indent = len(prop_line) - len(prop_line.lstrip())
                                properties.append((' ' * indent, uncommented))

                            # Check if we've found the closing
                            if brace_count == 0:
                                break

                            k += 1

                        # Now replace the block with Ably publish
                        indent = len(lines[j]) - len(lines[j].lstrip())
                        indent_str = ' ' * indent

                        # Build the replacement
                        replacement = []
                        replacement.append(f"{indent_str}// Publish to Ably real-time channel")
                        replacement.append(f"{indent_str}try {{")
                        replacement.append(f"{indent_str}  await publishToChannel('{channel}', '{event}', {{")

                        # Add properties
                        for prop_indent, prop in properties:
                            replacement.append(f"{indent_str}    {prop}")

                        replacement.append(f"{indent_str}  }});")
                        replacement.append(f"{indent_str}}} catch (ablyError) {{")
                        replacement.append(f"{indent_str}  console.error('Failed to publish to Ably:', ablyError.message);")
                        replacement.append(f"{indent_str}}}")

                        # Replace lines from i (TODO comment) to k (end of block)
                        lines[i:k+1] = replacement
                        modified = True

                        # Skip past the replaced section
                        i += len(replacement)
                        break

                j += 1

                # Safety: don't look too far ahead
                if j - i > 50:
                    break

        i += 1

    if modified:
        new_content = '\n'.join(lines)
        with open(filepath, 'w') as f:
            f.write(new_content)
        return True

    return False

# Migrate all files
migrated_files = []
for filepath in FILES_TO_MIGRATE:
    if os.path.exists(filepath):
        print(f"Processing: {filepath}")

        # Add import
        add_ably_import(filepath)

        # Migrate Socket.io to Ably
        if migrate_socket_to_ably(filepath):
            migrated_files.append(filepath)
            print(f"  ✓ Migrated to Ably")
        else:
            print(f"  - No changes needed")
    else:
        print(f"  ⚠ File not found: {filepath}")

print(f"\nTotal files migrated: {len(migrated_files)}")
for f in migrated_files:
    print(f"  - {f}")
