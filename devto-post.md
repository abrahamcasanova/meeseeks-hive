# Building Self-Improving AI Agents with React Three Fiber + pgvector

What if AI agents could learn from each other's successes and failures? That's Meeseeks Hive—autonomous agents that generate code, execute it in sandboxes, and share knowledge through vector embeddings.

![Meeseeks Hive Demo](https://github.com/abrahamcasanova/meeseeks-hive/raw/main/docs/assets/demo.gif)

## How It Works

```
1. Agent receives task: "Write a retry function with backoff"
2. Generates JavaScript using Claude/OpenAI/Ollama
3. Executes in Node.js sandbox → scores performance
4. Success? → Saves strategy + embedding to PostgreSQL
5. Next agent? → Queries pgvector for similar solutions
6. Reuses proven patterns, adapts to new context
```

The system gets smarter over time by building semantic memory.

## Key Features

**🧠 Semantic Memory with pgvector**  
Stores task embeddings in PostgreSQL. New agents query past strategies and inherit proven approaches.

**🎯 Smart Scoring**  
Penalizes multiple LLM requests (1 req = 10pts, 2 reqs = 8pts, etc). Incentivizes efficient first-try solutions.

**📊 Real-Time 3D Visualization**  
Watch agents compete as colored spheres in React Three Fiber. Lines show knowledge inheritance between generations.

![Dashboard](https://github.com/abrahamcasanova/meeseeks-hive/raw/main/docs/assets/screenshots_1.png)

**🔌 Multi-LLM Support**  
Swap between AWS Bedrock, OpenAI, Anthropic, or Ollama without code changes.

## Tech Stack

- **Backend:** Node.js + TypeScript + Express + PostgreSQL with pgvector
- **Frontend:** React 19 + Vite + React Three Fiber + Cytoscape.js
- **LLMs:** Claude Haiku, GPT-4o-mini, or local Ollama models

## Quick Start

```bash
git clone https://github.com/abrahamcasanova/meeseeks-hive.git
cd meeseeks-hive

# Add your API keys
cp .env.example .env

# Launch with Docker
docker compose --profile full up

# Visit http://localhost:3001
```

Create your first agent:

```bash
curl -X POST http://localhost:3001/api/v1/meeseeks \
  -H "Content-Type: application/json" \
  -d '{"task": "Write fetchWithRetry(url) with exponential backoff"}'
```

Watch it spawn, execute, and learn in real-time.

## Why This Matters

Most AI coding tools start from scratch every time. Meeseeks Hive agents build collective knowledge—they remember what worked, query semantically similar tasks, and evolve strategies based on actual performance data.

## Open Source

Licensed under **AGPL-3.0**. Commercial licenses available at abrahamcasanovac@outlook.com.

🔗 **GitHub:** https://github.com/abrahamcasanova/meeseeks-hive  
☕ **Support:** [Buy Me a Coffee](https://buymeacoffee.com/abrahamcasanova)

⭐ Star on GitHub if you find this interesting. PRs welcome!

---

*Built over nights and weekends. Questions? Drop them below!*
