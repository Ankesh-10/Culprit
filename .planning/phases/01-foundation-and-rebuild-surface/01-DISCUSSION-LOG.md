# Phase 1: Foundation and Rebuild Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-19
**Phase:** 1-Foundation and Rebuild Surface
**Areas discussed:** Repository shell, Fixture packages, Canonical serialization, Rebuild and Docker

---

## Repository shell

| Option | Description | Selected |
|--------|-------------|----------|
| One root npm package | Smallest install, lockfile, Docker, and offline-test surface | ✓ |
| Workspace/monorepo | More package boundaries, but unnecessary for the buildathon MVP | |

**User's choice:** User asked the agents and assistant to decide everything needed; the recommended root-package approach was approved.
**Notes:** Pin Node 22, use npm and a committed lockfile, keep strict TypeScript/Vite/Vitest, and make `make test` authoritative.

---

## Fixture packages

| Option | Description | Selected |
|--------|-------------|----------|
| Shared repository fixture packages | One package per incident, consumed by tests and the browser | ✓ |
| Duplicated TypeScript constants | Faster to prototype but risks drift between demo and tests | |

**User's choice:** User asked the agents and assistant to decide everything needed; the shared-file contract was approved.
**Notes:** Each package has a manifest, JSONL logs, self-describing JSON history, expected interpretation, caveats, and no machine-specific data.

---

## Canonical serialization

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned pure-core serializers | Stable JSON and Markdown generated from one structured result | ✓ |
| UI-derived or ad hoc output | Flexible but risks nondeterminism and duplicated logic | |

**User's choice:** User asked the agents and assistant to decide everything needed; the versioned pure-core contract was approved.
**Notes:** Explicit ordering, UTC `Z` timestamps, POSIX paths, stable numbers, warnings/assumptions/confidence, fixed Markdown sections, and no current-time/random/host-path values.

---

## Rebuild and Docker

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-stage Node 22 static build | Builds `dist` reproducibly and serves one documented artifact/port | ✓ |
| Development server as deployment surface | Smaller initially but weaker production/rebuild contract | |

**User's choice:** User asked the agents and assistant to decide everything needed; the multi-stage static-build approach was approved.
**Notes:** README must be executable documentation, `.env.example` must be secret-free, and offline claims distinguish runtime/test behavior from empty-cache dependency installation.

---

## Claude's Discretion

- Exact package versions, Node 22 patch, output field names, fixture prose, Docker runtime server/port, module decomposition, and snapshot-vs-file verification approach remain implementation choices within the locked boundaries.

## Deferred Ideas

- CLI exporter, extra formats, UI frameworks and secondary dependencies, browser automation, themes, shortcuts, animation, integrations, persistence, telemetry, and standalone reports were explicitly kept out of Phase 1.
