# LinkedIn Post - Meeseeks Hive (English)

---

Just launched Meeseeks Hive as open source 🚀

A multi-agent system where AI agents learn from each other through semantic memory.

**The problem I wanted to solve:**

Most AI coding tools generate code but don't learn from execution results. Every run starts from scratch.

What if agents could remember what worked before and share that knowledge?

**What I built:**

🧠 Autonomous agents that receive tasks in natural language
⚡ Generate JavaScript code and execute it in isolated sandboxes
📊 Score results based on efficiency and correctness
🔍 Store successful strategies as embeddings in PostgreSQL (pgvector)
🤝 Future agents query similar strategies and reuse proven patterns

In other words: **the system improves with every task**.

**Tech stack:**

Backend: Node.js + TypeScript + Express + PostgreSQL with pgvector
Frontend: React 19 + Vite + React Three Fiber (3D visualization)
LLMs: Support for Claude (Bedrock), OpenAI, and local models (Ollama)

The most challenging part was designing the scoring system to penalize multiple attempts, incentivizing efficient first-try solutions.

**Real-time visualization:**

Built a 3D dashboard where each agent is a colored sphere based on performance. Lines connect generations and show knowledge inheritance.

React Three Fiber was surprisingly powerful for this.

**What I learned:**

✅ pgvector in PostgreSQL is sufficient for small/medium projects (you don't always need a dedicated vector database)

✅ Autonomous loops need clear constraints or they run indefinitely

✅ WebSocket + REST is an effective combo: WS for real-time events, REST for CRUD

**Why I built this:**

As a developer, I'm fascinated by the intersection of AI and distributed systems. This project combines both worlds and let me explore technologies I don't use in my day job.

I also wanted to contribute something useful to the open source community.

**Open Source:**

📦 GitHub: https://github.com/abrahamcasanova/meeseeks-hive
📄 License: AGPL-3.0
🐳 Full Docker setup in 5 minutes

If you're interested in AI, multi-agent systems, or just watching agents compete in 3D, check it out.

PRs and feedback welcome. If you find value in the project, a ⭐ on GitHub would be amazing.

---

Built during nights and weekends in Mérida, Yucatán 🇲🇽

Questions? I'm available in the comments.

#MachineLearning #AI #OpenSource #JavaScript #React #PostgreSQL #MultiAgentSystems
