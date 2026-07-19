#!/usr/bin/env bash
#
# Worked example for the write-guard hook.
#
# Builds a throwaway project in a temp directory, feeds real PreToolUse payloads
# to the hook, and asserts the exit codes. Run it to see the guard work before
# you wire it into a repository you care about.
#
#   ./examples/worked-example.sh
#
set -uo pipefail

GUARD="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/guard_writes.py"
PROJECT="$(mktemp -d)"
trap 'rm -rf "$PROJECT"' EXIT

mkdir -p "$PROJECT/legal" "$PROJECT/src" "$PROJECT/infra/prod" "$PROJECT/docs"

cat > "$PROJECT/.write-guard.json" <<'JSON'
{
  "mode": "block",
  "protected": [
    {
      "pattern": "legal/",
      "reason": "Contracts and legal instruments change only by human instruction."
    },
    {
      "pattern": "docs/decision-register.md",
      "reason": "The decision record is the audit trail. Agents propose; humans write."
    },
    {
      "pattern": "infra/prod/**",
      "reason": "Production infrastructure is human-applied."
    },
    {
      "pattern": ".env*",
      "reason": "Secrets never move through an agent."
    }
  ],
  "allow": ["legal/README.md"]
}
JSON

failures=0

# assert <expected-exit> <tool> <path> <description>
assert() {
  local expected="$1" tool="$2" path="$3" desc="$4"
  local key="file_path"
  [ "$tool" = "NotebookEdit" ] && key="notebook_path"

  local output actual
  output=$(printf '{"cwd":"%s","hook_event_name":"PreToolUse","tool_name":"%s","tool_input":{"%s":"%s"}}' \
    "$PROJECT" "$tool" "$key" "$path" | python3 "$GUARD" 2>&1)
  actual=$?

  if [ "$actual" = "$expected" ]; then
    printf 'ok   %-46s exit=%s  %s\n' "$path" "$actual" "$desc"
  else
    printf 'FAIL %-46s exit=%s (want %s)  %s\n' "$path" "$actual" "$expected" "$desc"
    printf '     %s\n' "$output"
    failures=$((failures + 1))
  fi
}

echo "write-guard worked example"
echo "project: $PROJECT"
echo

# 0 = allowed, 2 = blocked
assert 2 Write        "legal/msa.md"              "contract — blocked"
assert 2 Edit         "legal/nested/addendum.md"  "nested under legal/ — blocked"
assert 0 Write        "legal/README.md"           "allow-list exception — permitted"
assert 2 Edit         "docs/decision-register.md" "exact file match — blocked"
assert 0 Edit         "docs/architecture.md"      "sibling file — permitted"
assert 2 Write        "infra/prod/main.tf"        "glob match — blocked"
assert 0 Write        "infra/dev/main.tf"         "non-prod infra — permitted"
assert 2 Write        ".env.production"           "secrets glob — blocked"
assert 0 Edit         "src/app.ts"                "ordinary source — permitted"
assert 2 NotebookEdit "legal/analysis.ipynb"      "notebook_path honoured — blocked"

echo
echo "--- what the agent sees on a block ---"
printf '{"cwd":"%s","tool_name":"Write","tool_input":{"file_path":"legal/msa.md"}}' "$PROJECT" \
  | python3 "$GUARD" 2>&1 || true

echo
if [ "$failures" -eq 0 ]; then
  echo "PASSED — all assertions held"
  exit 0
fi
echo "FAILED — $failures assertion(s)"
exit 1
