# Meeseeks Hive - Production Deployment Guide

## Overview

Meeseeks Hive is an autonomous SDK for AI agents. It's a monorepo with:
- `packages/core` — AI agent framework with sandbox execution
- Multi-LLM support (Bedrock, Anthropic, OpenAI, Ollama)
- In-memory strategy memory system
- WebSocket support for real-time agent communication

**No Docker** — SDK is meant to be imported as `@meeseeks-sdk/core` npm package.

---

## Files to EXCLUDE from Git (Already in .gitignore)

```
.env                    # Local development with secrets
.env.local             # Local overrides
dist/                  # Build output (generated)
node_modules/          # Dependencies (pnpm-lock.json is source of truth)
coverage/              # Test coverage
*.log                  # Logs
.turbo/                # Turbo cache
```

## Files REQUIRED in Git (Already Checked In)

✅ Source Code
- `packages/core/src/**/*` (SDK implementation)
- `packages/core/__tests__/**/*` (tests)

✅ Config
- `package.json` (root workspace)
- `packages/core/package.json`
- `pnpm-lock.yaml` (locked dependencies)
- `pnpm-workspace.yaml`
- `tsconfig.json` files
- `vitest.config.ts`

✅ Public Templates
- `.env.example` (no secrets)
- `.env.production` (no secrets, says CHANGE_ME)

✅ Documentation
- `README.md`
- `docs/` (all architecture docs)

---

## Deployment: As an NPM Package

Meeseeks Hive is published to npm as `@meeseeks-sdk/core`.

### For Consumers

```bash
npm install @meeseeks-sdk/core
# or
pnpm add @meeseeks-sdk/core
```

```javascript
import { MeeseeksSDK } from '@meeseeks-sdk/core';

const sdk = new MeeseeksSDK({
  llmProvider: 'anthropic',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

const result = await sdk.executeStrategy({
  objective: 'Build a feature',
  harness: 'coding'
});
```

### Publishing to npm

```bash
cd packages/core

# Update version in package.json
npm version patch

# Build
pnpm build

# Test
pnpm test

# Publish
npm publish
```

**Important**: The package name is scoped as `@meeseeks-sdk/core`.

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/meeseeks-hive.git
cd meeseeks-hive
```

### 2. Create .env (Local Development)

```bash
cp .env.example .env
```

Edit `.env` with your local development values:
```
DATABASE_URL=postgresql://meeseeks:meeseeks@localhost:5432/meeseeks_hive
REDIS_URL=redis://localhost:6379
LLM_PROVIDER=bedrock
BEDROCK_REGION=us-east-2
ANTHROPIC_API_KEY=sk-ant-...  # Only if using anthropic provider
OPENAI_API_KEY=sk-proj-...    # Only if using openai provider
NODE_ENV=development
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run Tests

```bash
pnpm test
```

### 5. Build

```bash
pnpm build
```

---

## For Meeseeks Tournament Integration

Meeseeks Tournament imports `@meeseeks-sdk/core` from npm:

```json
{
  "dependencies": {
    "@meeseeks-sdk/core": "^0.3.0"
  }
}
```

When deploying Tournament, it will use the published npm version.

To use a local version during development:

```bash
# In meeseeks-tournament
pnpm add --workspace ../../Sites/meeseeks-hive/packages/core
```

---

## Environment Variables Reference

### Database & Cache
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string (optional)

### LLM Provider Selection
- `LLM_PROVIDER`: `bedrock` | `anthropic` | `openai` | `ollama`

### AWS Bedrock
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_SESSION_TOKEN`: Optional session token
- `BEDROCK_REGION`: AWS region (default: us-east-2)
- `BEDROCK_CLAUDE_MODEL`: Model ID (default: Haiku)

### Anthropic Direct
- `ANTHROPIC_API_KEY`: Anthropic API key (sk-ant-...)

### OpenAI
- `OPENAI_API_KEY`: OpenAI API key (sk-proj-...)
- `OPENAI_MODEL`: Model name (default: gpt-4o-mini)

### Ollama Local
- `OLLAMA_BASE_URL`: Local Ollama endpoint (default: http://localhost:11434)
- `OLLAMA_MODEL`: Model name (default: llama3.2)

### Embeddings
- `EMBEDDING_PROVIDER`: `bedrock` | `openai`

### Server
- `PORT`: Express port (default: 3001)
- `WS_PORT`: WebSocket port (default: 3002)
- `NODE_ENV`: `development` | `production`

---

## Secrets Protection

`.env` is in `.gitignore`:

```bash
git check-ignore .env  # Should print: .env
```

Never commit `.env`. Create it manually on each deployment:

```bash
cp .env.production .env
# Edit with real values
```

---

## CI/CD Example (GitHub Actions)

```yaml
name: Build & Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build

  publish:
    needs: test
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm build
      - run: cd packages/core && npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Troubleshooting

### Tests fail
```bash
pnpm test --reporter=verbose
pnpm test --bail  # Stop on first failure
```

### Build fails
```bash
pnpm clean  # Remove node_modules, dist
pnpm install
pnpm build
```

### LLM provider not responding
```bash
# Check which provider is active
echo $LLM_PROVIDER

# Test Bedrock
aws bedrock list-foundation-models --region us-east-2

# Test OpenAI
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Ollama
curl http://localhost:11434/api/tags
```

### WebSocket connection fails
- Check `WS_PORT=3002` is accessible
- Verify firewall allows port 3002
- Check logs for auth errors

---

## Production Checklist

- [ ] `.env` created with all secrets (NOT in git)
- [ ] All API keys configured (Bedrock / OpenAI / etc)
- [ ] Tests passing: `pnpm test`
- [ ] Build succeeds: `pnpm build`
- [ ] LLM provider responding
- [ ] `.env` is gitignored
- [ ] No secrets in git history

---

## After Deployment

If deploying to a server:

1. **Copy repo**
   ```bash
   git clone https://github.com/yourusername/meeseeks-hive.git
   ```

2. **Create .env**
   ```bash
   cp .env.production .env
   vim .env  # Add real values
   ```

3. **Install & build**
   ```bash
   pnpm install
   pnpm build
   ```

4. **Run tests to verify**
   ```bash
   pnpm test
   ```

5. **Publish to npm (if needed)**
   ```bash
   cd packages/core
   npm publish
   ```

---

**Status**: ✅ Ready for development and npm publishing.
