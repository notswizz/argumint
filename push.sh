#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"commit message\"" >&2
  exit 1
fi

msg="$1"

# Ensure we run from the repo root (directory of this script)
cd "$(dirname "$0")"

branch="$(git rev-parse --abbrev-ref HEAD)"

echo "Staging changes..."
git add -A

if git diff --cached --quiet; then
  echo "No staged changes to commit. Skipping commit."
else
  echo "Committing: $msg"
  git commit -m "$msg"
fi

echo "Pushing to remote 'main' (branch: $branch)..."
if git push main "$branch":"$branch"; then
  echo "Push succeeded: $(git remote get-url --push main) ($branch)"
else
  echo "Default push failed. Trying with upstream set to main/$branch..."
  git push -u main "$branch"
fi

echo "Done."


