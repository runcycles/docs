#!/usr/bin/env bash
# Generate llms-full.txt from all documentation markdown files.
# Runs at build time to produce a single file optimized for LLM ingestion.
set -euo pipefail

DOCS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$DOCS_ROOT/public/llms-full.txt"

# Header
cat > "$OUTPUT" <<'HEADER'
# Cycles — Complete Documentation

> Budget authority for autonomous agents. Hard limits on agent spend and actions enforced before execution — not after. Open protocol, multi-language SDKs, Apache 2.0.

This file contains the full text of all Cycles documentation, optimized for LLM ingestion. For a lightweight navigation index, see llms.txt.

HEADER

# Sections in reading order
declare -a SECTIONS=(
  "quickstart:Quickstart"
  "concepts:Concepts"
  "protocol:Protocol Reference"
  "how-to:How-To Guides"
  "incidents:Incident Patterns"
  "configuration:Configuration"
)

strip_frontmatter() {
  # Remove YAML frontmatter (--- delimited block at start of file)
  awk 'BEGIN{fm=0} /^---$/{fm++; if(fm<=2) next} fm>=2||fm==0{print}' "$1"
}

for section_entry in "${SECTIONS[@]}"; do
  dir="${section_entry%%:*}"
  label="${section_entry#*:}"

  dir_path="$DOCS_ROOT/$dir"
  [ -d "$dir_path" ] || continue

  echo "---" >> "$OUTPUT"
  echo "" >> "$OUTPUT"
  echo "# $label" >> "$OUTPUT"
  echo "" >> "$OUTPUT"

  # Sort files for deterministic output
  for file in $(find "$dir_path" -name '*.md' -type f | sort); do
    [ -f "$file" ] || continue
    echo "" >> "$OUTPUT"
    strip_frontmatter "$file" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
  done
done

size=$(wc -c < "$OUTPUT")
lines=$(wc -l < "$OUTPUT")
echo "Generated llms-full.txt: ${lines} lines, $(( size / 1024 )) KB"
