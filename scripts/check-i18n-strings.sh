#!/usr/bin/env bash

set -euo pipefail

mapfile -t FILES < <(
  rg --files app components -g "*.tsx" \
    | rg -v "components/.*/__tests__/|components/.*/tests/|\\.stories\\.tsx$"
)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No TSX files found for i18n check."
  exit 0
fi

ATTRIBUTE_VIOLATIONS="$(
  rg -n --no-heading --pcre2 \
    '<[^>\n]*(placeholder|title|aria-label)\s*=\s*"[^"{][^"]+"' \
    "${FILES[@]}" || true
)"

TEXT_NODE_VIOLATIONS="$(
  rg -n --no-heading --pcre2 \
    '<[A-Za-z][^>\n]*>\s*[A-Za-zÀ-ÿ][^<{]*\s*</[A-Za-z]' \
    "${FILES[@]}" || true
)"

ERROR_LITERAL_VIOLATIONS="$(
  rg -n --no-heading --pcre2 \
    'set(Error|Success|Message)\s*\(\s*"[^"]+"' \
    "${FILES[@]}" || true
)"

ALL_VIOLATIONS="$(
  printf "%s\n%s\n%s\n" \
    "$ATTRIBUTE_VIOLATIONS" \
    "$TEXT_NODE_VIOLATIONS" \
    "$ERROR_LITERAL_VIOLATIONS" \
    | sed '/^\s*$/d'
)"

# Keep the allowlist tight and technical-only.
ALLOWLIST_PATTERN='AMOGUS|COCKPIT|AES-256|ERR_[A-Z_]+|IN_PROGRESS|LOBBY|FINISHED|CREWMATE|IMPOSTOR|ADMIN|BATCH-[A-Z0-9]+|A\)|B\)|C\)|D\)|E\)|F\)|G\)|H\)|I\)|J\)|K\)|L\)|M\)|N\)|O\)|P\)|Q\)|R\)|S\)|T\)|U\)|V\)|W\)|X\)|Y\)|Z\)'

FILTERED_VIOLATIONS="$(
  printf "%s\n" "$ALL_VIOLATIONS" | rg -v "$ALLOWLIST_PATTERN" || true
)"

if [[ -n "$FILTERED_VIOLATIONS" ]]; then
  echo "Found untranslated inline UI strings in app/components:"
  echo "$FILTERED_VIOLATIONS"
  exit 1
fi

echo "i18n string check passed for app/components."
