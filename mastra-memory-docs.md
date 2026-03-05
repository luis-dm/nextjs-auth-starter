# Storage

For agents to remember previous interactions, Mastra needs a database. Use a storage adapter for one of the [supported databases](#supported-providers) and pass it to your Mastra instance.

```typescript
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: "file:./mastra.db",
  }),
});
```

> **Sharing the database with Mastra Studio:** When running `mastra dev` alongside your application (e.g., Next.js), use an absolute path to ensure both processes access the same database:
>
> ```typescript
> url: "file:/absolute/path/to/your/project/mastra.db";
> ```
>
> Relative paths like `file:./mastra.db` resolve based on each process's working directory, which may differ.

This configures instance-level storage, which all agents share by default. You can also configure [agent-level storage](#agent-level-storage) for isolated data boundaries.

Mastra automatically creates the necessary tables on first interaction. See the [core schema](https://mastra.ai/reference/storage/overview) for details on what gets created, including tables for messages, threads, resources, workflows, traces, and evaluation datasets.

## Supported providers

Each provider page includes installation instructions, configuration parameters, and usage examples:

- [libSQL](https://mastra.ai/reference/storage/libsql)
- [PostgreSQL](https://mastra.ai/reference/storage/postgresql)
- [MongoDB](https://mastra.ai/reference/storage/mongodb)
- [Upstash](https://mastra.ai/reference/storage/upstash)
- [Cloudflare D1](https://mastra.ai/reference/storage/cloudflare-d1)
- [Cloudflare Durable Objects](https://mastra.ai/reference/storage/cloudflare)
- [Convex](https://mastra.ai/reference/storage/convex)
- [DynamoDB](https://mastra.ai/reference/storage/dynamodb)
- [LanceDB](https://mastra.ai/reference/storage/lance)
- [Microsoft SQL Server](https://mastra.ai/reference/storage/mssql)

> **Tip:** libSQL is the easiest way to get started because it doesn’t require running a separate database server.

## Configuration scope

Storage can be configured at the instance level (shared by all agents) or at the agent level (isolated to a specific agent).

### Instance-level storage

Add storage to your Mastra instance so all agents, workflows, observability traces and scores share the same memory provider:

```typescript
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

export const mastra = new Mastra({
  storage: new PostgresStore({
    id: "mastra-storage",
    connectionString: process.env.DATABASE_URL,
  }),
});

// Both agents inherit storage from the Mastra instance above
const agent1 = new Agent({ id: "agent-1", memory: new Memory() });
const agent2 = new Agent({ id: "agent-2", memory: new Memory() });
```

This is useful when all primitives share the same storage backend and have similar performance, scaling, and operational requirements.

#### Composite storage

[Composite storage](https://mastra.ai/reference/storage/composite) is an alternative way to configure instance-level storage. Use `MastraCompositeStore` to set the `memory` domain (and any other [domains](https://mastra.ai/reference/storage/composite) you need) to different storage providers.

```typescript
import { Mastra } from "@mastra/core";
import { MastraCompositeStore } from "@mastra/core/storage";
import { MemoryLibSQL } from "@mastra/libsql";
import { WorkflowsPG } from "@mastra/pg";
import { ObservabilityStorageClickhouse } from "@mastra/clickhouse";

export const mastra = new Mastra({
  storage: new MastraCompositeStore({
    id: "composite",
    domains: {
      memory: new MemoryLibSQL({ url: "file:./memory.db" }),
      workflows: new WorkflowsPG({
        connectionString: process.env.DATABASE_URL,
      }),
      observability: new ObservabilityStorageClickhouse({
        url: process.env.CLICKHOUSE_URL,
        username: process.env.CLICKHOUSE_USERNAME,
        password: process.env.CLICKHOUSE_PASSWORD,
      }),
    },
  }),
});
```

This is useful when different types of data have different performance or operational requirements, such as low-latency storage for memory, durable storage for workflows, and high-throughput storage for observability.

### Agent-level storage

Agent-level storage overrides storage configured at the instance level. Add storage to a specific agent when you need data boundaries or compliance requirements:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";

export const agent = new Agent({
  id: "agent",
  memory: new Memory({
    storage: new PostgresStore({
      id: "agent-storage",
      connectionString: process.env.AGENT_DATABASE_URL,
    }),
  }),
});
```

> **Warning:** [Mastra Cloud Store](https://mastra.ai/docs/mastra-cloud/deployment) doesn't support agent-level storage.

## Threads and resources

Mastra organizes conversations using two identifiers:

- **Thread** - a conversation session containing a sequence of messages.
- **Resource** - the entity that owns the thread, such as a user, organization, project, or any other domain entity in your application.

Both identifiers are required for agents to store information:

**Generate**:

```typescript
const response = await agent.generate("hello", {
  memory: {
    thread: "conversation-abc-123",
    resource: "user_123",
  },
});
```

**Stream**:

```typescript
const stream = await agent.stream("hello", {
  memory: {
    thread: "conversation-abc-123",
    resource: "user_123",
  },
});
```

> **Note:** [Studio](https://mastra.ai/docs/getting-started/studio) automatically generates a thread and resource ID for you. When calling `stream()` or `generate()` yourself, remember to provide these identifiers explicitly.

### Thread title generation

Mastra can automatically generate descriptive thread titles based on the user's first message when `generateTitle` is enabled.

Use this option when implementing a ChatGPT-style chat interface to render a title alongside each thread in the conversation list (for example, in a sidebar) derived from the thread’s initial user message.

```typescript
export const agent = new Agent({
  id: "agent",
  memory: new Memory({
    options: {
      generateTitle: true,
    },
  }),
});
```

Title generation runs asynchronously after the agent responds and does not affect response time.

To optimize cost or behavior, provide a smaller [`model`](https://mastra.ai/models) and custom `instructions`:

```typescript
export const agent = new Agent({
  id: "agent",
  memory: new Memory({
    options: {
      generateTitle: {
        model: "openai/gpt-4o-mini",
        instructions: "Generate a 1 word title",
      },
    },
  }),
});
```

## Semantic recall

Semantic recall has different storage requirements - it needs a vector database in addition to the standard storage adapter. See [Semantic recall](https://mastra.ai/docs/memory/semantic-recall) for setup and supported vector providers.

## Handling large attachments

Some storage providers enforce record size limits that base64-encoded file attachments (such as images) can exceed:

| Provider                                                           | Record size limit |
| ------------------------------------------------------------------ | ----------------- |
| [DynamoDB](https://mastra.ai/reference/storage/dynamodb)           | 400 KB            |
| [Convex](https://mastra.ai/reference/storage/convex)               | 1 MiB             |
| [Cloudflare D1](https://mastra.ai/reference/storage/cloudflare-d1) | 1 MiB             |

PostgreSQL, MongoDB, and libSQL have higher limits and are generally unaffected.

To avoid this, use an input processor to upload attachments to external storage (S3, R2, GCS, [Convex file storage](https://docs.convex.dev/file-storage), etc.) and replace them with URL references before persistence.

```typescript
import type { Processor } from "@mastra/core/processors";
import type { MastraDBMessage } from "@mastra/core/memory";

export class AttachmentUploader implements Processor {
  id = "attachment-uploader";

  async processInput({ messages }: { messages: MastraDBMessage[] }) {
    return Promise.all(messages.map((msg) => this.processMessage(msg)));
  }

  async processMessage(msg: MastraDBMessage) {
    const attachments = msg.content.experimental_attachments;
    if (!attachments?.length) return msg;

    const uploaded = await Promise.all(
      attachments.map(async (att) => {
        // Skip if already a URL
        if (!att.url?.startsWith("data:")) return att;

        // Upload base64 data and replace with URL
        const url = await this.upload(att.url, att.contentType);
        return { ...att, url };
      }),
    );

    return {
      ...msg,
      content: { ...msg.content, experimental_attachments: uploaded },
    };
  }

  async upload(dataUri: string, contentType?: string): Promise<string> {
    const base64 = dataUri.split(",")[1];
    const buffer = Buffer.from(base64, "base64");

    // Replace with your storage provider (S3, R2, GCS, Convex, etc.)
    // return await s3.upload(buffer, contentType);
    throw new Error("Implement upload() with your storage provider");
  }
}
```

Use the processor with your agent:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { AttachmentUploader } from "./processors/attachment-uploader";

const agent = new Agent({
  id: "my-agent",
  memory: new Memory({ storage: yourStorage }),
  inputProcessors: [new AttachmentUploader()],
});
```

# Message History

Message history is the most basic and important form of memory. It gives the LLM a view of recent messages in the context window, enabling your agent to reference earlier exchanges and respond coherently.

You can also retrieve message history to display past conversations in your UI.

> **Info:** Each message belongs to a thread (the conversation) and a resource (the user or entity it's associated with). See [Threads and resources](https://mastra.ai/docs/memory/storage) for more detail.

## Getting started

Install the Mastra memory module along with a [storage adapter](https://mastra.ai/docs/memory/storage) for your database. The examples below use `@mastra/libsql`, which stores data locally in a `mastra.db` file.

**npm**:

```bash
npm install @mastra/memory@latest @mastra/libsql@latest
```

**pnpm**:

```bash
pnpm add @mastra/memory@latest @mastra/libsql@latest
```

**Yarn**:

```bash
yarn add @mastra/memory@latest @mastra/libsql@latest
```

**Bun**:

```bash
bun add @mastra/memory@latest @mastra/libsql@latest
```

Message history requires a storage adapter to persist conversations. Configure storage on your Mastra instance if you haven't already:

```typescript
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: "file:./mastra.db",
  }),
});
```

Give your agent a `Memory`:

```typescript
import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";

export const agent = new Agent({
  id: "test-agent",
  memory: new Memory({
    options: {
      lastMessages: 10,
    },
  }),
});
```

When you call the agent, messages are automatically saved to the database. You can specify a `threadId`, `resourceId`, and optional `metadata`:

**Generate**:

```typescript
await agent.generate("Hello", {
  memory: {
    thread: {
      id: "thread-123",
      title: "Support conversation",
      metadata: { category: "billing" },
    },
    resource: "user-456",
  },
});
```

**Stream**:

```typescript
await agent.stream("Hello", {
  memory: {
    thread: {
      id: "thread-123",
      title: "Support conversation",
      metadata: { category: "billing" },
    },
    resource: "user-456",
  },
});
```

> **Info:** Threads and messages are created automatically when you call `agent.generate()` or `agent.stream()`, but you can also create them manually with [`createThread()`](https://mastra.ai/reference/memory/createThread) and [`saveMessages()`](https://mastra.ai/reference/memory/memory-class).

There are two ways to use this history:

- **Automatic inclusion** - Mastra automatically fetches and includes recent messages in the context window. By default, it includes the last 10 messages, keeping agents grounded in the conversation. You can adjust this number with `lastMessages`, but in most cases you don't need to think about it.
- [**Manual querying**](#querying) - For more control, use the `recall()` function to query threads and messages directly. This lets you choose exactly which memories are included in the context window, or fetch messages to render conversation history in your UI.

## Accessing Memory

To access memory functions for querying, cloning, or deleting threads and messages, call `getMemory()` on an agent:

```typescript
const agent = mastra.getAgent("weatherAgent");
const memory = await agent.getMemory();
```

The `Memory` instance gives you access to functions for listing threads, recalling messages, cloning conversations, and more.

## Querying

Use these methods to fetch threads and messages for displaying conversation history in your UI or for custom memory retrieval logic.

> **Warning:** The memory system does not enforce access control. Before running any query, verify in your application logic that the current user is authorized to access the `resourceId` being queried.

### Threads

Use [`listThreads()`](https://mastra.ai/reference/memory/listThreads) to retrieve threads for a resource:

```typescript
const result = await memory.listThreads({
  filter: { resourceId: "user-123" },
  perPage: false,
});
```

Paginate through threads:

```typescript
const result = await memory.listThreads({
  filter: { resourceId: "user-123" },
  page: 0,
  perPage: 10,
});

console.log(result.threads); // thread objects
console.log(result.hasMore); // more pages available?
```

You can also filter by metadata and control sort order:

```typescript
const result = await memory.listThreads({
  filter: {
    resourceId: "user-123",
    metadata: { status: "active" },
  },
  orderBy: { field: "createdAt", direction: "DESC" },
});
```

To fetch a single thread by ID, use [`getThreadById()`](https://mastra.ai/reference/memory/getThreadById):

```typescript
const thread = await memory.getThreadById({ threadId: "thread-123" });
```

### Messages

Once you have a thread, use [`recall()`](https://mastra.ai/reference/memory/recall) to retrieve its messages. It supports pagination, date filtering, and [semantic search](https://mastra.ai/docs/memory/semantic-recall).

Basic recall returns all messages from a thread:

```typescript
const { messages } = await memory.recall({
  threadId: "thread-123",
  perPage: false,
});
```

Paginate through messages:

```typescript
const { messages } = await memory.recall({
  threadId: "thread-123",
  page: 0,
  perPage: 50,
});
```

Filter by date range:

```typescript
const { messages } = await memory.recall({
  threadId: "thread-123",
  filter: {
    dateRange: {
      start: new Date("2025-01-01"),
      end: new Date("2025-06-01"),
    },
  },
});
```

Fetch a single message by ID:

```typescript
const { messages } = await memory.recall({
  threadId: "thread-123",
  include: [{ id: "msg-123" }],
});
```

Fetch multiple messages by ID with surrounding context:

```typescript
const { messages } = await memory.recall({
  threadId: "thread-123",
  include: [
    { id: "msg-123" },
    {
      id: "msg-456",
      withPreviousMessages: 3,
      withNextMessages: 1,
    },
  ],
});
```

Search by meaning (see [Semantic recall](https://mastra.ai/docs/memory/semantic-recall) for setup):

```typescript
const { messages } = await memory.recall({
  threadId: "thread-123",
  vectorSearchString: "project deadline discussion",
  threadConfig: {
    semanticRecall: true,
  },
});
```

### UI format

Message queries return `MastraDBMessage[]` format. To display messages in a frontend, you may need to convert them to a format your UI library expects. For example, [`toAISdkV5Messages`](https://mastra.ai/reference/ai-sdk/to-ai-sdk-v5-messages) converts messages to AI SDK UI format.

## Thread cloning

Thread cloning creates a copy of an existing thread with its messages. This is useful for branching conversations, creating checkpoints before a potentially destructive operation, or testing variations of a conversation.

```typescript
const { thread, clonedMessages } = await memory.cloneThread({
  sourceThreadId: "thread-123",
  title: "Branched conversation",
});
```

You can filter which messages get cloned (by count or date range), specify custom thread IDs, and use utility methods to inspect clone relationships.

See [`cloneThread()`](https://mastra.ai/reference/memory/cloneThread) and [clone utilities](https://mastra.ai/reference/memory/clone-utilities) for the full API.

## Deleting messages

To remove messages from a thread, use [`deleteMessages()`](https://mastra.ai/reference/memory/deleteMessages). You can delete by message ID or clear all messages from a thread.

# Observational Memory

**Added in:** `@mastra/memory@1.1.0`

Observational Memory (OM) is Mastra's memory system for long-context agentic memory. Two background agents — an **Observer** and a **Reflector** — watch your agent's conversations and maintain a dense observation log that replaces raw message history as it grows.

## Quick Start

Enable `observationalMemory` in the memory options when creating your agent:

```typescript
import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";

export const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant.",
  model: "openai/gpt-5-mini",
  memory: new Memory({
    options: {
      observationalMemory: true,
    },
  }),
});
```

That's it. The agent now has humanlike long-term memory that persists across conversations. Setting `observationalMemory: true` uses `google/gemini-2.5-flash` by default. To use a different model or customize thresholds, pass a config object instead:

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      model: "deepseek/deepseek-reasoner",
    },
  },
});
```

See [configuration options](https://mastra.ai/reference/memory/observational-memory) for full API details.

> **Note:** OM currently only supports `@mastra/pg`, `@mastra/libsql`, and `@mastra/mongodb` storage adapters. It uses background agents for managing memory. When using `observationalMemory: true`, the default model is `google/gemini-2.5-flash`. When passing a config object, a `model` must be explicitly set.

## Benefits

- **Prompt caching**: OM's context is stable — observations append over time rather than being dynamically retrieved each turn. This keeps the prompt prefix cacheable, which reduces costs.
- **Compression**: Raw message history and tool results get compressed into a dense observation log. Smaller context means faster responses and longer coherent conversations.
- **Zero context rot**: The agent sees relevant information instead of noisy tool calls and irrelevant tokens, so the agent stays on task over long sessions.

## How It Works

You don't remember every word of every conversation you've ever had. You observe what happened subconsciously, then your brain reflects — reorganizing, combining, and condensing into long-term memory. OM works the same way.

Every time an agent responds, it sees a context window containing its system prompt, recent message history, and any injected context. The context window is finite — even models with large token limits perform worse when the window is full. This causes two problems:

- **Context rot**: the more raw message history an agent carries, the worse it performs.
- **Context waste**: most of that history contains tokens no longer needed to keep the agent on task.

OM solves both problems by compressing old context into dense observations.

### Observations

When message history tokens exceed a threshold (default: 30,000), the Observer creates observations — concise notes about what happened:

```text
Date: 2026-01-15
- 🔴 12:10 User is building a Next.js app with Supabase auth, due in 1 week (meaning January 22nd 2026)
  - 🔴 12:10 App uses server components with client-side hydration
  - 🟡 12:12 User asked about middleware configuration for protected routes
  - 🔴 12:15 User stated the app name is "Acme Dashboard"
```

The compression is typically 5–40×. The Observer also tracks a **current task** and **suggested response** so the agent picks up where it left off.

Example: an agent using Playwright MCP might see 50,000+ tokens per page snapshot. With OM, the Observer watches the interaction and creates a few hundred tokens of observations about what was on the page and what actions were taken. The agent stays on task without carrying every raw snapshot.

### Reflections

When observations exceed their threshold (default: 40,000 tokens), the Reflector condenses them — combining related items and reflecting on patterns.

The result is a three-tier system:

1. **Recent messages**: Exact conversation history for the current task
2. **Observations**: A log of what the Observer has seen
3. **Reflections**: Condensed observations when memory becomes too long

## Models

The Observer and Reflector run in the background. Any model that works with Mastra's [model routing](https://mastra.ai/models) (`provider/model`) can be used. When using `observationalMemory: true`, the default model is `google/gemini-2.5-flash`. When passing a config object, a `model` must be explicitly set.

Generally speaking, we recommend using a model that has a large context window (128K+ tokens) and is fast enough to run in the background without slowing down your actions.

If you're unsure which model to use, start with the default `google/gemini-2.5-flash`. We've also successfully tested `openai/gpt-5-mini`, `anthropic/claude-haiku-4-5`, `deepseek/deepseek-reasoner`, `qwen3`, and `glm-4.7`.

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      model: "deepseek/deepseek-reasoner",
    },
  },
});
```

See [model configuration](https://mastra.ai/reference/memory/observational-memory) for using different models per agent.

## Scopes

### Thread scope (default)

Each thread has its own observations. This scope is well tested and works well as a general purpose memory system, especially for long horizon agentic use-cases.

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      model: "google/gemini-2.5-flash",
      scope: "thread",
    },
  },
});
```

Thread scope requires a valid `threadId` to be provided when calling the agent. If `threadId` is missing, Observational Memory throws an error. This prevents multiple threads from silently sharing a single observation record, which can cause database deadlocks.

### Resource scope (experimental)

Observations are shared across all threads for a resource (typically a user). Enables cross-conversation memory.

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      model: "google/gemini-2.5-flash",
      scope: "resource",
    },
  },
});
```

Resource scope works, however it's marked as experimental for now until we prove task adherence/continuity across multiple ongoing simultaneous threads. As of today, you may need to tweak your system prompt to prevent one thread from continuing the work that another had already started (but hadn't finished).

This is because in resource scope, each thread is a perspective on _all_ threads for the resource.

For your use-case this may not be a problem, so your mileage may vary.

> **Warning:** In resource scope, unobserved messages across _all_ threads are processed together. For users with many existing threads, this can be slow. Use thread scope for existing apps.

## Token Budgets

OM uses token thresholds to decide when to observe and reflect. See [token budget configuration](https://mastra.ai/reference/memory/observational-memory) for details.

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      model: "google/gemini-2.5-flash",
      observation: {
        // when to run the Observer (default: 30,000)
        messageTokens: 30_000,
      },
      reflection: {
        // when to run the Reflector (default: 40,000)
        observationTokens: 40_000,
      },
      // let message history borrow from observation budget
      // requires bufferTokens: false (temporary limitation)
      shareTokenBudget: false,
    },
  },
});
```

### Token counting cache

OM caches tiktoken part estimates in message metadata to reduce repeat counting work during threshold checks and buffering decisions.

- Per-part estimates are stored on `part.providerMetadata.mastra` and reused on subsequent passes when the cache version/tokenizer source matches.
- For string-only message content (without parts), OM uses a message-level metadata fallback cache.
- Message and conversation overhead are still recalculated on every pass. The cache only stores payload estimates, so counting semantics stay the same.
- `data-*` and `reasoning` parts are still skipped and are not cached.

## Async Buffering

Without async buffering, the Observer runs synchronously when the message threshold is reached — the agent pauses mid-conversation while the Observer LLM call completes. With async buffering (enabled by default), observations are pre-computed in the background as the conversation grows. When the threshold is hit, buffered observations activate instantly with no pause.

### How it works

As the agent converses, message tokens accumulate. At regular intervals (`bufferTokens`), a background Observer call runs without blocking the agent. Each call produces a "chunk" of observations that's stored in a buffer.

When message tokens reach the `messageTokens` threshold, buffered chunks activate: their observations move into the active observation log, and the corresponding raw messages are removed from the context window. The agent never pauses.

Buffered observations also include continuation hints — a suggested next response and the current task — so the main agent maintains conversational continuity after activation shrinks the context window.

If the agent produces messages faster than the Observer can process them, a `blockAfter` safety threshold forces a synchronous observation as a last resort. Buffered activation still preserves a minimum remaining context (the smaller of \~1k tokens or the configured retention floor).

Reflection works similarly — the Reflector runs in the background when observations reach a fraction of the reflection threshold.

### Settings

| Setting                        | Default | What it controls                                                                                                                                                                      |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observation.bufferTokens`     | `0.2`   | How often to buffer. `0.2` means every 20% of `messageTokens` — with the default 30k threshold, that's roughly every 6k tokens. Can also be an absolute token count (e.g. `5000`).    |
| `observation.bufferActivation` | `0.8`   | How aggressively to clear the message window on activation. `0.8` means remove enough messages to keep only 20% of `messageTokens` remaining. Lower values keep more message history. |
| `observation.blockAfter`       | `1.2`   | Safety threshold as a multiplier of `messageTokens`. At `1.2`, synchronous observation is forced at 36k tokens (1.2 × 30k). Only matters if buffering can't keep up.                  |
| `reflection.bufferActivation`  | `0.5`   | When to start background reflection. `0.5` means reflection begins when observations reach 50% of the `observationTokens` threshold.                                                  |
| `reflection.blockAfter`        | `1.2`   | Safety threshold for reflection, same logic as observation.                                                                                                                           |

### Disabling

To disable async buffering and use synchronous observation/reflection instead:

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      model: "google/gemini-2.5-flash",
      observation: {
        bufferTokens: false,
      },
    },
  },
});
```

Setting `bufferTokens: false` disables both observation and reflection async buffering. See [async buffering configuration](https://mastra.ai/reference/memory/observational-memory) for the full API.

> **Note:** Async buffering is not supported with `scope: 'resource'`. It is automatically disabled in resource scope.

## Migrating existing threads

No manual migration needed. OM reads existing messages and observes them lazily when thresholds are exceeded.

- **Thread scope**: The first time a thread exceeds `observation.messageTokens`, the Observer processes the backlog.
- **Resource scope**: All unobserved messages across all threads for a resource are processed together. For users with many existing threads, this could take significant time.

## Viewing in Mastra Studio

Mastra Studio shows OM status in real time in the memory tab: token usage, which model is running, current observations, and reflection history.

## Comparing OM with other memory features

- **[Message history](https://mastra.ai/docs/memory/message-history)**: High-fidelity record of the current conversation
- **[Working memory](https://mastra.ai/docs/memory/working-memory)**: Small, structured state (JSON or markdown) for user preferences, names, goals
- **[Semantic Recall](https://mastra.ai/docs/memory/semantic-recall)**: RAG-based retrieval of relevant past messages

If you're using working memory to store conversation summaries or ongoing state that grows over time, OM is a better fit. Working memory is for small, structured data; OM is for long-running event logs. OM also manages message history automatically—the `messageTokens` setting controls how much raw history remains before observation runs.

In practical terms, OM replaces both working memory and message history, and has greater accuracy (and lower cost) than Semantic Recall.

## Related

- [Observational Memory Reference](https://mastra.ai/reference/memory/observational-memory)
- [Memory Overview](https://mastra.ai/docs/memory/overview)
- [Message History](https://mastra.ai/docs/memory/message-history)
- [Memory Processors](https://mastra.ai/docs/memory/memory-processors)

# Working Memory

While [message history](https://mastra.ai/docs/memory/message-history) and [semantic recall](https://mastra.ai/docs/memory/semantic-recall) help agents remember conversations, working memory allows them to maintain persistent information about users across interactions.

Think of it as the agent's active thoughts or scratchpad – the key information they keep available about the user or task. It's similar to how a person would naturally remember someone's name, preferences, or important details during a conversation.

This is useful for maintaining ongoing state that's always relevant and should always be available to the agent.

Working memory can persist at two different scopes:

- **Resource-scoped** (default): Memory persists across all conversation threads for the same user
- **Thread-scoped**: Memory is isolated per conversation thread

**Important:** Switching between scopes means the agent won't see memory from the other scope - thread-scoped memory is completely separate from resource-scoped memory.

## Quick Start

Here's a minimal example of setting up an agent with working memory:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

// Create agent with working memory enabled
const agent = new Agent({
  id: "personal-assistant",
  name: "PersonalAssistant",
  instructions: "You are a helpful personal assistant.",
  model: "openai/gpt-5.1",
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
      },
    },
  }),
});
```

## How it Works

Working memory is a block of Markdown text that the agent is able to update over time to store continuously relevant information:

[YouTube video player](https://www.youtube-nocookie.com/embed/UMy_JHLf1n8)

## Memory Persistence Scopes

Working memory can operate in two different scopes, allowing you to choose how memory persists across conversations:

### Resource-Scoped Memory (Default)

By default, working memory persists across all conversation threads for the same user (resourceId), enabling persistent user memory:

```typescript
const memory = new Memory({
  storage,
  options: {
    workingMemory: {
      enabled: true,
      scope: "resource", // Memory persists across all user threads
      template: `# User Profile
- **Name**:
- **Location**:
- **Interests**:
- **Preferences**:
- **Long-term Goals**:
`,
    },
  },
});
```

**Use cases:**

- Personal assistants that remember user preferences
- Customer service bots that maintain customer context
- Educational applications that track student progress

### Usage with Agents

When using resource-scoped memory, make sure to pass the `resource` parameter in the memory options:

```typescript
// Resource-scoped memory requires resource
const response = await agent.generate("Hello!", {
  memory: {
    thread: "conversation-123",
    resource: "user-alice-456", // Same user across different threads
  },
});
```

### Thread-Scoped Memory

Thread-scoped memory isolates working memory to individual conversation threads. Each thread maintains its own isolated memory:

```typescript
const memory = new Memory({
  storage,
  options: {
    workingMemory: {
      enabled: true,
      scope: "thread", // Memory is isolated per thread
      template: `# User Profile
- **Name**:
- **Interests**:
- **Current Goal**:
`,
    },
  },
});
```

**Use cases:**

- Different conversations about separate topics
- Temporary or session-specific information
- Workflows where each thread needs working memory but threads are ephemeral and not related to each other

## Storage Adapter Support

Resource-scoped working memory requires specific storage adapters that support the `mastra_resources` table:

### Supported Storage Adapters

- **libSQL** (`@mastra/libsql`)
- **PostgreSQL** (`@mastra/pg`)
- **Upstash** (`@mastra/upstash`)
- **MongoDB** (`@mastra/mongodb`)

## Custom Templates

Templates guide the agent on what information to track and update in working memory. While a default template is used if none is provided, you'll typically want to define a custom template tailored to your agent's specific use case to ensure it remembers the most relevant information.

Here's an example of a custom template. In this example the agent will store the users name, location, timezone, etc as soon as the user sends a message containing any of the info:

```typescript
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `
# User Profile

## Personal Info

- Name:
- Location:
- Timezone:

## Preferences

- Communication Style: [e.g., Formal, Casual]
- Project Goal:
- Key Deadlines:
  - [Deadline 1]: [Date]
  - [Deadline 2]: [Date]

## Session State

- Last Task Discussed:
- Open Questions:
  - [Question 1]
  - [Question 2]
`,
    },
  },
});
```

## Designing Effective Templates

A well-structured template keeps the information easy for the agent to parse and update. Treat the template as a short form that you want the assistant to keep up to date.

- **Short, focused labels.** Avoid paragraphs or very long headings. Keep labels brief (for example `## Personal Info` or `- Name:`) so updates are easy to read and less likely to be truncated.
- **Use consistent casing.** Inconsistent capitalization (`Timezone:` vs `timezone:`) can cause messy updates. Stick to Title Case or lower case for headings and bullet labels.
- **Keep placeholder text simple.** Use hints such as `[e.g., Formal]` or `[Date]` to help the LLM fill in the correct spots.
- **Abbreviate very long values.** If you only need a short form, include guidance like `- Name: [First name or nickname]` or `- Address (short):` rather than the full legal text.
- **Mention update rules in `instructions`.** You can instruct how and when to fill or clear parts of the template directly in the agent's `instructions` field.

### Alternative Template Styles

Use a shorter single block if you only need a few items:

```typescript
const basicMemory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `User Facts:\n- Name:\n- Favorite Color:\n- Current Topic:`,
    },
  },
});
```

You can also store the key facts in a short paragraph format if you prefer a more narrative style:

```typescript
const paragraphMemory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      template: `Important Details:\n\nKeep a short paragraph capturing the user's important facts (name, main goal, current task).`,
    },
  },
});
```

## Structured Working Memory

Working memory can also be defined using a structured schema instead of a Markdown template. This allows you to specify the exact fields and types that should be tracked, using a [Zod](https://zod.dev/) schema. When using a schema, the agent will see and update working memory as a JSON object matching your schema.

**Important:** You must specify either `template` or `schema`, but not both.

### Example: Schema-Based Working Memory

```typescript
import { z } from "zod";
import { Memory } from "@mastra/memory";

const userProfileSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  preferences: z
    .object({
      communicationStyle: z.string().optional(),
      projectGoal: z.string().optional(),
      deadlines: z.array(z.string()).optional(),
    })
    .optional(),
});

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      schema: userProfileSchema,
      // template: ... (do not set)
    },
  },
});
```

When a schema is provided, the agent receives the working memory as a JSON object. For example:

```json
{
  "name": "Sam",
  "location": "Berlin",
  "timezone": "CET",
  "preferences": {
    "communicationStyle": "Formal",
    "projectGoal": "Launch MVP",
    "deadlines": ["2025-07-01"]
  }
}
```

### Merge Semantics for Schema-Based Memory

Schema-based working memory uses **merge semantics**, meaning the agent only needs to include fields it wants to add or update. Existing fields are preserved automatically.

- **Object fields are deep merged:** Only provided fields are updated; others remain unchanged
- **Set a field to `null` to delete it:** This explicitly removes the field from memory
- **Arrays are replaced entirely:** When an array field is provided, it replaces the existing array (arrays are not merged element-by-element)

## Choosing Between Template and Schema

- Use a **template** (Markdown) if you want the agent to maintain memory as a free-form text block, such as a user profile or scratchpad. Templates use **replace semantics** — the agent must provide the complete memory content on each update.
- Use a **schema** if you need structured, type-safe data that can be validated and programmatically accessed as JSON. Schemas use **merge semantics** — the agent only provides fields to update, and existing fields are preserved.
- Only one mode can be active at a time: setting both `template` and `schema` is not supported.

## Example: Multi-step Retention

Below is a simplified view of how the `User Profile` template updates across a short user conversation:

```nohighlight
# User Profile

## Personal Info

- Name:
- Location:
- Timezone:

--- After user says "My name is **Sam** and I'm from **Berlin**" ---

# User Profile
- Name: Sam
- Location: Berlin
- Timezone:

--- After user adds "By the way I'm normally in **CET**" ---

# User Profile
- Name: Sam
- Location: Berlin
- Timezone: CET
```

The agent can now refer to `Sam` or `Berlin` in later responses without requesting the information again because it has been stored in working memory.

If your agent is not properly updating working memory when you expect it to, you can add system instructions on _how_ and _when_ to use this template in your agent's `instructions` setting.

## Setting Initial Working Memory

While agents typically update working memory through the `updateWorkingMemory` tool, you can also set initial working memory programmatically when creating or updating threads. This is useful for injecting user data (like their name, preferences, or other info) that you want available to the agent without passing it in every request.

### Setting Working Memory via Thread Metadata

When creating a thread, you can provide initial working memory through the metadata's `workingMemory` key:

```typescript
// Create a thread with initial working memory
const thread = await memory.createThread({
  threadId: "thread-123",
  resourceId: "user-456",
  title: "Medical Consultation",
  metadata: {
    workingMemory: `# Patient Profile
- Name: John Doe
- Blood Type: O+
- Allergies: Penicillin
- Current Medications: None
- Medical History: Hypertension (controlled)
`,
  },
});

// The agent will now have access to this information in all messages
await agent.generate("What's my blood type?", {
  memory: {
    thread: thread.id,
    resource: "user-456",
  },
});
// Response: "Your blood type is O+."
```

### Updating Working Memory Programmatically

You can also update an existing thread's working memory:

```typescript
// Update thread metadata to add/modify working memory
await memory.updateThread({
  id: "thread-123",
  title: thread.title,
  metadata: {
    ...thread.metadata,
    workingMemory: `# Patient Profile
- Name: John Doe
- Blood Type: O+
- Allergies: Penicillin, Ibuprofen  // Updated
- Current Medications: Lisinopril 10mg daily  // Added
- Medical History: Hypertension (controlled)
`,
  },
});
```

### Direct Memory Update

Alternatively, use the `updateWorkingMemory` method directly:

```typescript
await memory.updateWorkingMemory({
  threadId: "thread-123",
  resourceId: "user-456", // Required for resource-scoped memory
  workingMemory: "Updated memory content...",
});
```

## Read-Only Working Memory

In some scenarios, you may want an agent to have access to working memory data without the ability to modify it. This is useful for:

- **Routing agents** that need context but shouldn't update user profiles
- **Sub agents** in a multi-agent system that should reference but not own the memory

To enable read-only mode, set `readOnly: true` in the memory options:

```typescript
const response = await agent.generate("What do you know about me?", {
  memory: {
    thread: "conversation-123",
    resource: "user-alice-456",
    options: {
      readOnly: true, // Working memory is provided but cannot be updated
    },
  },
});
```

## Examples

- [Working memory with template](https://github.com/mastra-ai/mastra/tree/main/examples/memory-with-template)
- [Working memory with schema](https://github.com/mastra-ai/mastra/tree/main/examples/memory-with-schema)
- [Per-resource working memory](https://github.com/mastra-ai/mastra/tree/main/examples/memory-per-resource-example) - Complete example showing resource-scoped memory persistence
