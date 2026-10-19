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

# Phase 3 was built plan by plan, but model.ts, serialization.ts and several
# test files carry hunks from more than one plan, so the groups below are
# ordered by dependency: each commit only imports what an earlier one added.
# .planning/config.json is left out on purpose (local use_worktrees edit).

commit_group "03 evidence and scoring" \
  src/core/normalization.ts \
  src/core/model.ts \
  src/core/evidence.ts \
  src/core/scoring.ts \
  tests/core/evidence.test.ts \
  tests/core/scoring.test.ts

commit_group "03 escaped markdown" \
  src/core/markdown.ts \
  tests/core/markdown.test.ts

commit_group "03 ranker and pipeline" \
  src/core/ranking.ts \
  src/core/buckets.ts \
  src/core/pipeline.ts \
  src/core/serialization.ts \
  tests/core/ranking.test.ts \
  tests/core/pipeline.test.ts \
  tests/core/serialization.test.ts \
  tests/core/fixture-contract.test.ts \
  tests/core/analysis-fixture.test.ts

commit_group "03 fixture contract and docs" \
  fixtures/incidents/slow-burn/expected.json \
  tests/core/fixture-ranking.test.ts \
  tests/core/golden/ambiguous.canonical.json \
  tests/core/determinism.test.ts \
  README.md

commit_group "03 planning records" \
  .planning/phases/03-evidence-ranking-and-trust-model \
  .planning/ROADMAP.md \
  .planning/REQUIREMENTS.md \
  .planning/STATE.md \
  commit-phase3.sh
