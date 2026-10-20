#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! git diff --cached --quiet; then
  echo "Staged changes already exist. Commit or unstage them first." >&2
  exit 1
fi

commit_group() {
  local message="$1"
  shift

  git add -- "$@"
  if git diff --cached --quiet; then
    echo "skip: $message"
    return 0
  fi

  git commit -m "$message"
}

# Phase 5 was committed plan by plan, so every group below normally skips.
# Polish (themes, shortcuts, motion) is gated and is not part of these groups.
# .planning/config.json is left out on purpose (local use_worktrees edit).

commit_group "05 rebuild path and static server" \
  scripts/serve-dist.mjs \
  scripts/serve-dist.d.mts \
  Dockerfile \
  .gitattributes \
  .github/workflows/ci.yml \
  tests/core/serve-dist.test.ts \
  tests/core/rebuild-surface.test.ts

commit_group "05 near-cap input and bounded renders" \
  scripts/near-cap-input.mjs \
  scripts/near-cap-input.d.mts \
  src/ui/view-model.ts \
  src/ui/shortlist.ts \
  src/ui/timeline-geometry.ts \
  tests/ui/near-cap.test.ts \
  tests/ui/view-model.test.ts \
  tests/ui/timeline-geometry.test.ts

commit_group "05 limits in markdown and rehearsal" \
  src/core/serialization.ts \
  tests/core/serialization.test.ts \
  tests/core/output-fingerprint.test.ts \
  tests/ui/demo-rehearsal.test.ts \
  tests/ui/copy.test.ts \
  README.md

commit_group "05 planning records" \
  .planning/phases/05-hardening-and-conditional-polish \
  .planning/ROADMAP.md \
  .planning/REQUIREMENTS.md \
  .planning/STATE.md \
  commit-phase5.sh
