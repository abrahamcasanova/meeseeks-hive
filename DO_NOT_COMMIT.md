# DO NOT COMMIT - Secrets & Local Files

This document lists files that **MUST NEVER** be committed to git in meeseeks-hive.

## Actively Excluded by .gitignore ✅

These are already in `.gitignore` and will be rejected if you try to commit them:

```
.env                        ← Production secrets (API keys)
.env.*                      ← All .env files (except .env.example)
dist/                       ← Compiled JavaScript (rebuilt on each build)
node_modules/               ← Dependencies (pnpm-lock.yaml is source of truth)
coverage/                   ← Test coverage reports
*.log                       ← Application logs
.turbo/                     ← Turbo cache
.DS_Store                   ← macOS metadata
```

## Why These Are Excluded

| File | Reason | Risk |
|------|--------|------|
| `.env` | Contains `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AWS_SECRET_ACCESS_KEY` | Credentials leaked to attacker |
| `dist/` | 5-10MB compiled output from `pnpm build` | Bloats repo, unnecessary |
| `node_modules/` | 500MB+ dependencies from `pnpm-lock.yaml` | Bloats repo, already reproducible |
| `coverage/` | Test output (auto-generated) | Clutters repo, not needed |
| `*.log` | Runtime logs | Leaks error details |

## What SHOULD Be Committed ✅

### Source Code
- `packages/core/src/**`
- `packages/core/__tests__/**`
- All TypeScript files

### Config & Lock Files
- `package.json` (root + packages/core)
- `pnpm-lock.yaml` (locked dependencies)
- `pnpm-workspace.yaml`
- `tsconfig.json` files
- `vitest.config.ts`

### Public Templates (No Secrets)
- `.env.example` (template only, no secrets)
- `.env.production` (template only, all values say CHANGE_ME)

### Documentation
- `README.md`
- `docs/` (all markdown files)
- `DEPLOY.md`
- This file

---

## If You Accidentally Committed Secrets

### 1. Immediately Revoke Compromised Credentials

```bash
# Example: ANTHROPIC_API_KEY is leaked
# → Log into Anthropic console
# → Regenerate API key
# → Update .env locally
```

### 2. Remove from Git History

```bash
# Remove from last commit only
git reset --soft HEAD~1
git reset HEAD .env
rm .env
git commit -m "Remove secrets"

# If already pushed, force-push to rewrite history
git push origin main --force-with-lease
```

### 3. Use git-filter-repo (Nuclear Option)

```bash
pip install git-filter-repo
git filter-repo --path .env --invert-paths
git push origin main --force-with-lease
```

---

## Preventing Accidental Commits

### Pre-Commit Hook (Optional)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
if git diff --cached | grep -E "ANTHROPIC_API_KEY|OPENAI_API_KEY|AWS_SECRET"; then
  echo "ERROR: Secrets detected in staged files!"
  exit 1
fi
```

### GitHub Secret Scanning

Enable in repository settings:
- Security → Secret scanning → Alert on pushes

---

## Audit Commands

Check if any secrets are committed:

```bash
# Search git history
git log --all -p | grep -iE "sk-ant|sk-proj|AKIA" | head -5

# Search staging area
git diff --cached | grep -iE "sk-ant|sk-proj"

# Verify .env is ignored
git check-ignore .env  # Should print: .env
```

---

## Approved Public Information

These files are safe to commit (no secrets):

- `.env.example` — Shows env structure, no real values
- `.env.production` — Shows env structure, all values say "CHANGE_ME"
- `README.md` — Usage guide, no credentials
- `docs/` — Architecture, no auth details

---

## After Deployment

When `.env` is in a deployed environment:

1. ✅ File exists only on deployment machine at `/path/to/.env`
2. ❌ File **never** appears in `git log`
3. ✅ File is only readable by application process
4. ❌ File is never tracked by git

```bash
# Verify
git check-ignore .env        # Should print: .env
git log --all --name-only | grep "\.env"  # Should print: nothing
```

---

**Status**: ✅ All secrets protected. Safe for open source deployment.
