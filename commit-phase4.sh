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

# Phase 4 was committed plan by plan, so every group below normally skips.
# The groups are ordered by dependency and mirror the plan boundaries.
# .planning/config.json is left out on purpose (local use_worktrees edit).

commit_group "04 analysis worker and page state" \
  src/worker/analyze.worker.ts \
  src/worker/protocol.ts \
  src/ui/analysis-client.ts \
  src/ui/state.ts \
  src/ui/status.ts \
  src/ui/app.ts \
  src/ui/dom.ts \
  src/main.ts \
  vite.config.ts \
  tests/ui/page-states.test.ts \
  tests/ui/tracer.test.ts \
  tests/ui/static-safety.test.ts

commit_group "04 case picker, tokens and fonts" \
  index.html \
  src/styles.css \
  src/assets/fonts/FONTS.md \
  src/ui/case-picker.ts \
  src/ui/cases.ts \
  src/ui/fonts.ts \
  src/ui/sparkline.ts \
  tests/ui/case-picker.test.ts \
  tests/ui/contrast.test.ts

commit_group "04 verdict and suspect lineup" \
  src/ui/format.ts \
  src/ui/view-model.ts \
  src/ui/verdict.ts \
  src/ui/shortlist.ts \
  tests/ui/format.test.ts \
  tests/ui/view-model.test.ts

commit_group "04 timeline, signatures and log lines" \
  src/ui/timeline-geometry.ts \
  src/ui/timeline.ts \
  src/ui/investigation-model.ts \
  src/ui/signatures.ts \
  src/ui/log-lines.ts \
  tests/ui/timeline-geometry.test.ts \
  tests/ui/investigation-model.test.ts

commit_group "04 suspect drawer, copy and trust footer" \
  src/ui/drawer-model.ts \
  src/ui/drawer.ts \
  src/ui/copy.ts \
  src/ui/trust-footer.ts \
  tests/ui/drawer-model.test.ts \
  tests/ui/copy.test.ts

commit_group "04 own files intake and docs" \
  src/ui/inputs.ts \
  src/ui/intake.ts \
  tests/ui/intake.test.ts \
  README.md

commit_group "04 planning records" \
  .planning/phases/04-incident-console-and-investigation-flow \
  .planning/ROADMAP.md \
  .planning/REQUIREMENTS.md \
  .planning/STATE.md \
  commit-phase4.sh
