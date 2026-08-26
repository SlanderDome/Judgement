# Judgement

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Graphify](https://img.shields.io/badge/skill-graphify-purple.svg)
![gstack](https://img.shields.io/badge/skill-gstack-orange.svg)

**Judgement** is a project developed by [SlanderDome](https://github.com/SlanderDome), pre-configured with **Graphify** and **gstack** agent skills.

---

## 📖 Overview

Brief description of what **Judgement** does, its primary goals, and key capabilities.

---

## 🤖 Agent Setup & Tooling

This repository is initialized with local agent skills under `.agents/skills/`:

- **[Graphify](file:///d:/Judgement/.agents/skills/graphify/SKILL.md)**: Builds AST knowledge graphs of the codebase to optimize context lookup and structural dependency tracking for AI coding agents.
- **[gstack](file:///d:/Judgement/.agents/skills/gstack/SKILL.md)**: Agent workflow suite for architecture planning, design review, QA testing, and shipping.

---

## ✨ Features

- **Feature 1**: Description of key capability.
- **Feature 2**: Description of key capability.
- **Feature 3**: Description of key capability.

---

## 🛠️ Tech Stack

- **Framework**: Node.js / TypeScript / Python
- **Agent Tooling**: Graphify (`.agents/skills/graphify`) & gstack (`.agents/skills/gstack`)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18+) or [Python](https://www.python.org/) (v3.10+)
- `git`
- `graphify` CLI tool (installed via `uv tool install graphifyy` or `pipx install graphifyy`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SlanderDome/Judgement.git
   cd Judgement
   ```

2. **Initialize Codebase Graph**
   ```bash
   graphify update .
   ```

---

## 📂 Project Structure

```
Judgement/
├── .agents/
│   └── skills/
│       ├── graphify/    # Graphify knowledge graph skill
│       └── gstack/      # gstack workflow skills suite
├── README.md
└── ...
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
