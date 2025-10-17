#!/usr/bin/env python3
import re
import os

files = [
    'routes/streaming.js',
    'routes/stream-chat.js',
    'routes/tokens.js',
    'routes/recording.js',
    'routes/enhanced-subscriptions.js',
    'routes/polls.js',
    'routes/questions.js',
    'routes/goals.js',
    'routes/live-shopping.js',
    'routes/shop.js',
    'routes/loyalty.js'
]

def extract_channel_and_event(lines):
    """Extract channel and event from io.to().emit() pattern"""
    # Find the line with io.to().emit()
    for line in lines:
        match = re.search(r"io\.to\((.*?)\)\.emit\('([^']+)'", line)
        if match:
            return match.group(1), match.group(2)
    return None, None

def extract_payload(lines):
    """Extract payload object from commented lines"""
    payload_lines = []
    in_payload = False

    for line in lines:
        # Start of payload (line with {)
        if '{' in line and not in_payload:
            in_payload = True
            continue
        # End of payload (line with });)
        if '});' in line:
            break
        # Payload content
        if in_payload:
            # Remove comment markers and clean up
            clean_line = line.strip()
            if clean_line.startswith('//'):
                clean_line = clean_line[2:].strip()
            if clean_line and not clean_line.startswith('//'):
                payload_lines.append(clean_line)

    return payload_lines

def migrate_file(filepath):
    print(f"\nProcessing {filepath}...")

    with open(filepath, 'r') as f:
        lines = f.readlines()

    new_lines = []
    i = 0
    replacements = 0

    while i < len(lines):
        line = lines[i]

        # Check if this is a TODO line
        if 'TODO: Replace with Ably' in line:
            # Collect all lines until we find the end of the commented block
            block_lines = [line]
            j = i + 1
            while j < len(lines) and (lines[j].strip().startswith('//') or lines[j].strip() == ''):
                block_lines.append(lines[j])
                j += 1
                if '});' in lines[j-1]:
                    break

            # Extract channel, event, and payload
            channel, event = extract_channel_and_event(block_lines)
            payload_lines = extract_payload(block_lines)

            if channel and event:
                # Get indentation from the TODO line
                indent = len(line) - len(line.lstrip())
                indent_str = ' ' * indent

                # Generate the replacement code
                replacement = f"{indent_str}try {{\n"
                replacement += f"{indent_str}  await publishToChannel({channel}, '{event}', {{\n"
                for payload_line in payload_lines:
                    replacement += f"{indent_str}    {payload_line}\n"
                replacement += f"{indent_str}  }});\n"
                replacement += f"{indent_str}}} catch (ablyError) {{\n"
                replacement += f"{indent_str}  logger.error('Failed to publish {event} to Ably:', ablyError.message);\n"
                replacement += f"{indent_str}}}\n"

                new_lines.append(replacement)
                replacements += 1

                # Skip the entire commented block
                i = j
                continue

        new_lines.append(line)
        i += 1

    if replacements > 0:
        with open(filepath, 'w') as f:
            f.writelines(new_lines)
        print(f"  ✓ Replaced {replacements} TODO blocks")
    else:
        print(f"  ! No TODO blocks found")

    return replacements

# Main execution
print("Starting TODO migration...")
total_replacements = 0

for file in files:
    if os.path.exists(file):
        total_replacements += migrate_file(file)
    else:
        print(f"File not found: {file}")

print(f"\n✓ Migration complete! Total replacements: {total_replacements}")
