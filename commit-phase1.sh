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

commit_group "01 shell" \
  commit-phase1.sh \
  .gitignore \
  .nvmrc \
  package.json \
  package-lock.json \
  tsconfig.json \
  tsconfig.node.json \
  vite.config.ts \
  index.html

commit_group "02 core" \
  src/core/model.ts \
  src/core/serialization.ts

commit_group "03 ui" \
  src/main.ts \
  src/styles.css

commit_group "04 fixtures" \
  fixtures/incidents/checkout-outage \
  fixtures/incidents/slow-burn \
  fixtures/incidents/ambiguous

commit_group "05 tests" \
  tests/core/fixture-contract.test.ts \
  tests/core/serialization.test.ts \
  tests/core/rebuild-surface.test.ts

commit_group "06 ops" \
  Dockerfile \
  .dockerignore \
  Makefile \
  .env.example \
  README.md

echo "Commit script complete. Internal planning files were intentionally excluded."
