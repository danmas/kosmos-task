# kosmos-task

**One executable Markdown file = full living project**

Idea → tasks → code → result → conclusions — all in a single `.kosmos.md` file that can be executed by a human, a script, or an AI agent.

100% Git-friendly • 100% readable • 100% alive

## Why this is different

| Regular repo                          | kosmos-task                                 |
|---------------------------------------|---------------------------------------------|
| 17 files, package.json, docs, tests   | 1 file                                             |
| You read README                        | You read and run the document at the same time     |
| AI generates scattered code            | AI generates a 100% valid executable .kosmos.md    |
| Progress is hidden in issues           | Progress is visible in the file itself             |
| Execution requires setup               | Just run `bun kosmos-runner-cli.js project.kosmos.md` |

## Quick start

```bash
# Clone & install
git clone https://github.com/danmas/kosmos-task.git
cd kosmos-task
bun install

# Run the living document
bun kosmos-runner-cli.js test-example.kosmos.md

# Or start the REST API server
bun run server

# Development mode with hot-reload
bun run dev

# Generate a new project using AI (Task Factory)
bun run factory
```

> 💡 Node.js is also supported: `bun run start:node` / `bun run server:node`

Press Y → watch the code execute → see the file update itself with real results and progress.

## Format (v2.0)

```markdown
# Build a CLI Tree Viewer .kosmos.md

**Status:** in progress
**Progress:** 0%
**Last update:** 2025-12-08

## Summary (filled at the end)

(empty))

## Goal

Create a tiny zero-dependency CLI utility that prints a beautiful directory tree.

## Task 1: Print hello world

### Step 1: Say hello
- [ ] Done
 ```js executable
 console.log("Hello from inside the document!");
 ```
Expected result: The message appears in the console

Result:
(empty)

Verification:
- [ ] passed
```

That’s it. Every step is readable, executable, and verifiable.

## Features

- Human-readable Markdown
- Auto-executes `executable` code blocks (currently JavaScript)
- Sandboxed via Node.js `vm` module
- Updates progress and date automatically
- Perfect zero-shot generation with modern LLMs (Claude 3.5, GPT-4o, Grok, Llama 3.1, etc.)
- **Task Factory included**: Interactive CLI to generate detailed project plans using AI (Questions -> Plan)
- Works beautifully in Obsidian, VS Code, GitHub, GitLab

## Use with AI

Just paste the content of `specification/kosmos-spec-v1.0.json` as a system prompt and write your idea in the user message.  
You will receive a **perfectly valid** `.kosmos.md` file every single time (tested error rate ≈ 0%).

## Project structure

```
kosmos-task/
├── kosmos-runner-cli.js          # v2.0 executor
├── server/                       # REST API server
│   ├── index.js                  # Entry point
│   ├── routes/                   # API routes
│   ├── services/                 # Business logic
│   └── utils/                    # Utilities
├── specification/
│   ├── kosmos-spec-v1.0.json     # System prompt (battle-tested)
│   └── kosmos-spec-v1.0.yaml
├── bunfig.toml                   # Bun configuration
├── test-example.kosmos.md        # Try it now
└── README.md
```

## Requirements

- [Bun](https://bun.sh) v1.0+ (recommended) or Node.js 18+

## License

MIT — do whatever you want with it.

Created with love in 2025.

**kosmos-task is not just a tool. It’s a new way for ideas to exist.**
