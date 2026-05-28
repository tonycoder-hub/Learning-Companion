# GitHub Permissions Setup

This project should use a dedicated GitHub permission path so it does not mix with the existing ByteDance/global Git configuration on this Mac.

## Recommended Model

Use a GitHub deploy key for this repository:

- One SSH key pair is generated only for `learning-companion`.
- The public key is added to the GitHub repository as a deploy key.
- The deploy key is granted write access only for this repository.
- Git remotes use a dedicated SSH host alias, not the default `github.com` host.

This gives the project least-privilege access. If the project later splits into multiple repositories, switch to a dedicated GitHub machine user or fine-grained personal access token.

## Local Files

The recommended local SSH identity is:

```text
~/.ssh/learning_companion_github_ed25519
~/.ssh/learning_companion_github_ed25519.pub
```

The recommended SSH host alias is:

```sshconfig
Host github-learning-companion
  HostName github.com
  User git
  IdentityFile ~/.ssh/learning_companion_github_ed25519
  IdentitiesOnly yes
  AddKeysToAgent yes
  UseKeychain yes
```

Repository remotes should then look like:

```bash
git remote add origin git@github-learning-companion:OWNER/REPO.git
```

## First-Time Setup

1. Create an empty private repository on GitHub.
2. Run:

   ```bash
   ./scripts/setup-github-ssh.sh
   ```

   By default this creates a key without a passphrase so setup can run non-interactively. To use a passphrase, run:

   ```bash
   SSH_KEY_PASSPHRASE="your-passphrase" ./scripts/setup-github-ssh.sh
   ```

3. Copy the printed public key.
4. In GitHub, open the repository settings:

   ```text
   Settings -> Deploy keys -> Add deploy key
   ```

5. Paste the public key and enable write access.
6. Configure the local repository:

   ```bash
   ./scripts/configure-github-remote.sh OWNER REPO "Git Author Name" "git-author-email@example.com"
   ```

7. Verify SSH access:

   ```bash
   ssh -T github-learning-companion
   ```

8. Push:

   ```bash
   git push -u origin main
   ```

## Notes

- Do not add project-specific GitHub credentials to the global Git config.
- Do not use the existing ByteDance Git identity for this repository.
- The local Git author is intentionally unset until `configure-github-remote.sh` is run.
- Keep Feishu API credentials, GitHub tokens, and signing keys out of Git.
- If GitHub Actions later needs Feishu sync secrets, store them as repository secrets.
