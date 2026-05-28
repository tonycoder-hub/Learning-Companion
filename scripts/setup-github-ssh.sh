#!/usr/bin/env bash
set -euo pipefail

KEY_PATH="${HOME}/.ssh/learning_companion_github_ed25519"
HOST_ALIAS="github-learning-companion"
SSH_CONFIG="${HOME}/.ssh/config"
SSH_KEY_PASSPHRASE="${SSH_KEY_PASSPHRASE:-}"

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

if [[ ! -f "${KEY_PATH}" ]]; then
  ssh-keygen -t ed25519 -C "learning-companion-github" -f "${KEY_PATH}" -N "${SSH_KEY_PASSPHRASE}"
else
  echo "SSH key already exists: ${KEY_PATH}"
fi

chmod 600 "${KEY_PATH}"
chmod 644 "${KEY_PATH}.pub"

if ! grep -q "Host ${HOST_ALIAS}" "${SSH_CONFIG}" 2>/dev/null; then
  {
    echo ""
    echo "Host ${HOST_ALIAS}"
    echo "  HostName github.com"
    echo "  User git"
    echo "  IdentityFile ~/.ssh/learning_companion_github_ed25519"
    echo "  IdentitiesOnly yes"
    echo "  AddKeysToAgent yes"
    echo "  UseKeychain yes"
  } >> "${SSH_CONFIG}"
  chmod 600 "${SSH_CONFIG}"
else
  echo "SSH host alias already exists: ${HOST_ALIAS}"
fi

echo ""
echo "Add this public key to the GitHub repository deploy keys:"
echo ""
cat "${KEY_PATH}.pub"
echo ""
