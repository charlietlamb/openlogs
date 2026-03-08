# OpenLogs

Give coding agents direct access to your logs.

OpenLogs turns raw product, API, worker, and infra events into a stream agents can inspect so they can debug failures, trace requests, and answer with real runtime context instead of guesses.

## Install

```bash
npm i -g openlogs
```

## Setup

### 01 — Run with openlogs

Prefix your existing dev command to pipe its output into the stream.

```bash
openlogs bun run dev
openlogs npm run dev
openlogs node server.js
```

**Flags**

| Flag | Description | Default |
|---|---|---|
| `--out-dir <path>` | Directory for log files | `.openlogs` |
| `--name <name>` | Log filename base | `latest` |
| `--raw-only` | Skip cleaned text log, write raw only | — |
| `--text-only` | Skip raw PTY log, write text only | — |
| `--no-history` | Don't write timestamped history copies | — |
| `--print-paths` | Print log file paths before running | — |

> `--raw-only` and `--text-only` are mutually exclusive.

After each run, logs are written to `.openlogs/latest.raw.log` and `.openlogs/latest.txt`.

---

### 02 — Tell your agent to use the CLI to check the logs

Your agent can tail the live stream at any point during a debugging session.

```bash
openlogs tail
```

**Flags**

| Flag | Description | Default |
|---|---|---|
| `--out-dir <path>` | Directory to find log file | `.openlogs` |
| `--raw` | Read raw PTY log instead of cleaned text | — |
| `[tail args...]` | Forwarded to system tail (e.g. `-f`, `-n 50`) | — |

```bash
openlogs tail -n 100
openlogs tail --raw -n 100
openlogs tail -f
```

---

### 03 — Install the skill to make this even easier

The OpenLogs skill teaches your agent when and how to check logs automatically — no manual prompting needed.

```bash
npx skills add https://github.com/charlietlamb/openlogs
```

---

## Development

```bash
bun install
bun run dev
```

Local CLI usage without installing globally:

```bash
bun packages/ol/src/cli.ts bun run dev
```

## Contributing

If OpenLogs is useful to you, a star helps others find it: [github.com/charlietlamb/openlogs](https://github.com/charlietlamb/openlogs)
