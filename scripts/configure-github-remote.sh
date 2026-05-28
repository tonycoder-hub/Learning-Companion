#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "Usage: $0 OWNER REPO \"Git Author Name\" \"git-author-email@example.com\""
  exit 1
fi

OWNER="$1"
REPO="$2"
AUTHOR_NAME="$3"
AUTHOR_EMAIL="$4"
REMOTE_URL="git@github-learning-companion:${OWNER}/${REPO}.git"

git init
git branch -M main
git config --local user.name "${AUTHOR_NAME}"
git config --local user.email "${AUTHOR_EMAIL}"
git config --local core.sshCommand "ssh -F ${HOME}/.ssh/config"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "${REMOTE_URL}"
else
  git remote add origin "${REMOTE_URL}"
fi

echo "Configured origin: ${REMOTE_URL}"
echo "Configured local author: ${AUTHOR_NAME} <${AUTHOR_EMAIL}>"
