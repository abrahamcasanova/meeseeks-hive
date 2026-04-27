# Meeseeks Hive - Production Checklist

## Code Status ✅

- [x] All source code committed
- [x] Tests committed
- [x] TypeScript config committed
- [x] pnpm-lock.yaml committed
- [x] `.env` excluded from git (in `.gitignore`)
- [x] `.env.example` included (no secrets)
- [x] `.env.production` template created (no secrets)

---

## What's NOT in Git (Secrets Protected)

```
✓ .env                      — API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, AWS_SECRET)
✓ .aws/credentials          — AWS Bedrock credentials (mount from host)
✓ node_modules/             — Dependencies (rebuilt from pnpm-lock.yaml)
✓ dist/                     — Build artifacts (compiled fresh)
✓ .turbo/                   — Turbo cache
✓ *.log                     — Logs
```

---

## What IS in Git

### Source Code
```
✓ packages/core/src/**/*    — SDK implementation
✓ packages/core/__tests__/**/* — Tests
```

### Config
```
✓ package.json (root)
✓ packages/core/package.json
✓ pnpm-lock.yaml
✓ pnpm-workspace.yaml
✓ tsconfig.json
✓ vitest.config.ts
```

### Documentation
```
✓ README.md
✓ docs/
✓ DEPLOY.md
✓ DO_NOT_COMMIT.md
```

### Public Templates
```
✓ .env.example              — Template with examples (no secrets)
✓ .env.production           — Template with structure (no secrets)
```

---

## Deployment Steps

### Option 1: Local Development

```bash
cd meeseeks-hive
cp .env.example .env
# Edit .env with local dev values

pnpm install
pnpm test
pnpm build
```

### Option 2: Production Server

```bash
# 1. Clone
git clone https://github.com/yourusername/meeseeks-hive.git
cd meeseeks-hive

# 2. Create .env (with production values)
cp .env.production .env
vim .env  # Edit with real API keys

# 3. Install & build
pnpm install
pnpm build

# 4. Test
pnpm test

# 5. Publish to npm (if releasing new version)
cd packages/core
npm publish
```

### Option 3: Publish as npm Package

```bash
cd packages/core

# Update version
npm version patch

# Build
pnpm build

# Test
pnpm test

# Publish
npm publish
```

---

## Required Changes in .env

**DO NOT use .env.example or .env.production directly.**

Copy to `.env` and change:

- [ ] `DATABASE_URL` — Your PostgreSQL connection string
- [ ] `REDIS_URL` — Your Redis connection string (or remove if not needed)
- [ ] `LLM_PROVIDER` — Choose: `bedrock` | `anthropic` | `openai` | `ollama`
- [ ] `ANTHROPIC_API_KEY` — Your Anthropic API key (if using anthropic provider)
- [ ] `OPENAI_API_KEY` — Your OpenAI API key (if using openai provider)
- [ ] `AWS_ACCESS_KEY_ID` — Your AWS access key (if using bedrock)
- [ ] `AWS_SECRET_ACCESS_KEY` — Your AWS secret key (if using bedrock)
- [ ] `BEDROCK_REGION` — Your AWS region (default: us-east-2)
- [ ] `NODE_ENV` — Set to `production` for live deployment

---

## Verification

```bash
# ✓ Code builds
pnpm build

# ✓ Tests pass
pnpm test

# ✓ No secrets in git
git log --all -p | grep -E "sk-ant|sk-proj|AKIA|AWS_SECRET" | head -1

# ✓ .env is gitignored
git check-ignore .env  # Should print: .env

# ✓ Dependencies locked
cat pnpm-lock.yaml | head -3  # Should have version info
```

---

## Final Checklist

- [ ] `.env` created (with real secrets)
- [ ] `.env` is **NOT** in git history
- [ ] All tests passing: `pnpm test`
- [ ] Build succeeds: `pnpm build`
- [ ] LLM provider responding (test API key)
- [ ] `.env` gitignored: `git check-ignore .env` ✓
- [ ] No secrets in git log

---

## Files Reference

| File | Purpose | Git | Notes |
|------|---------|-----|-------|
| `.env` | Development secrets | ❌ NO | Create locally, never commit |
| `.env.example` | Template for devs | ✅ YES | Shows structure with examples |
| `.env.production` | Template for prod | ✅ YES | Shows structure, all CHANGE_ME |
| `pnpm-lock.yaml` | Locked versions | ✅ YES | Source of truth for deps |
| `package.json` | Dependencies | ✅ YES | Workspace config |
| `dist/` | Build output | ❌ NO | Compiled fresh each build |
| `node_modules/` | Dependencies | ❌ NO | Rebuilt from lock file |

---

## Support

- **Tests fail?** → `pnpm test --reporter=verbose`
- **Build fails?** → `pnpm clean && pnpm install && pnpm build`
- **API key issues?** → Verify `.env` has correct provider and key
- **Publishing issues?** → Check npm token in `~/.npmrc`

---

**Status**: ✅ Production-ready. SDK can be published to npm.

**Next**: See DEPLOY.md for detailed deployment guide.
