---
phase: 04-incident-console-and-investigation-flow
plan: 01
subsystem: ui
tags: [vite, web-worker, typescript, plain-dom, vitest, static-safety]

requires:
  - phase: 03-evidence-ranking-and-trust-model
    provides: analyze() pipeline, AnalysisStream, ranking, confidence labels
provides:
  - Bundled-case loader (?raw fixture imports plus manifest metadata)
  - Worker protocol and shared handleAnalyzeRequest with structured-clone-safe failures
  - Module worker plus client with main-thread fallback
  - Text-only DOM helpers, verdict view model and renderer, console controller and shell
  - Static safety test over src/ and index.html
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08]

actuals:
  tokens: 7900
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Text-only DOM construction: el()/svgEl() assign textContent and setAttribute only"
    - "One request handler shared by the worker and the main-thread fallback"
    - "Failures cross the worker boundary as plain data without Error instances or raw input text"

key-files:
  created:
    - src/ui/cases.ts
    - src/ui/dom.ts
    - src/ui/view-model.ts
    - src/ui/verdict.ts
    - src/ui/app.ts
    - src/ui/analysis-client.ts
    - src/worker/protocol.ts
    - src/worker/analyze.worker.ts
    - tests/ui/tracer.test.ts
    - tests/ui/static-safety.test.ts
  modified:
    - index.html
    - src/main.ts
    - vite.config.ts

key-decisions:
  - "Client and worker share handleAnalyzeRequest, so worker and fallback results are identical by construction"
  - "The Vite client type reference lives at the top of src/ui/cases.ts and applies program-wide"
  - "Static safety scans raw text of every src .ts file and index.html, comments included"

requirements-completed: [UX-01]

coverage:
  - id: D1
    description: "One click on a bundled case analyzes it locally and shows the leading suspect headline (2222222, 5555555, or No clear culprit with candidate 9999999)"
    requirement: UX-01
    verification:
      - kind: unit
        ref: "tests/ui/tracer.test.ts#handleAnalyzeRequest headlines"
        status: pass
    human_judgment: true
    rationale: "The click-to-render path in a real browser (focus, aria-pressed, visible heading) is not exercised by node-environment tests; the verifier should click each case."
  - id: D2
    description: "Worker with identical main-thread fallback (null factory, throwing factory, worker error, concurrent ids, stray ids)"
    requirement: UX-01
    verification:
      - kind: unit
        ref: "tests/ui/tracer.test.ts#analysis client"
        status: pass
      - kind: other
        ref: "npm run build emits dist/assets/analyze.worker-*.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Failures shown as plain-text messages without raw input or Error instances; markup characters stay literal text"
    requirement: UX-01
    verification:
      - kind: unit
        ref: "tests/ui/tracer.test.ts#handleAnalyzeRequest failures"
        status: pass
      - kind: unit
        ref: "tests/ui/static-safety.test.ts#has no HTML-string sink"
        status: pass
    human_judgment: false
  - id: D4
    description: "No network API, storage API, external URL, clock/locale API in UI code, or new dependency"
    verification:
      - kind: unit
        ref: "tests/ui/static-safety.test.ts"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-19
status: complete
plan_head_before: e18f27b0998623d01228287bd43901c8836d7342
plan_head_after: 08f853fa2e5375556a66187565105cc63233c260
commits: 3
---

# Phase 4 Plan 01: One-click case analysis through the worker boundary Summary

**Click a bundled case and see "Result: {name}" with the leading suspect (or "No clear culprit" plus the leading candidate), analyzed in a module worker with an identical main-thread fallback, guarded by static no-HTML-sink, no-network and no-new-dependency checks.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-19T16:49:32Z
- **Completed:** 2026-10-19T16:54:47Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Console shell (`index.html`) replaced the Phase 1 hero; `mountApp` renders three case buttons labelled "Load {name}" with `aria-pressed` on the loaded case.
- `handleAnalyzeRequest` maps `analyze()` outcomes to `result` or plain `error` data (no `raw`, no Error instance, structured-clone-safe), with `INVALID_REQUEST` and `INTERNAL_ERROR` paths; it never throws.
- `createAnalysisClient` starts the worker lazily, matches responses by request id, ignores unknown ids, and falls back to the main thread on a null or throwing factory, a worker `error`/`messageerror`, or a `postMessage` throw.
- `dist/assets/analyze.worker-*.js` is emitted as a separate chunk.
- `tests/ui/static-safety.test.ts` locks HTML sinks, network APIs, storage APIs, absolute URLs (only the SVG namespace in `src/ui/dom.ts`), clock/random/locale APIs in `src/ui` and `src/worker`, and the dependency list.

## Task Commits

1. **Task 1: Tracer (case click to verdict headline)** - `bc4bfa6` (feat)
2. **Task 2 RED: failing client tests and static safety checks** - `2389494` (test)
3. **Task 2 GREEN: module worker, client with fallback, vite worker format** - `08f853f` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Tracer gate

Tracer verified end to end (typecheck, tracer test, build, rebuild-surface test) before Task 2 expanded; no human-check was declared and `human_verify_mode` is `end-of-phase`, so no checkpoint was raised.

## TDD notes (Task 2)

- RED (`2389494`): `analysis-client.ts` was an interface-only stub whose `analyze` rejects with "not implemented"; the five client tests (null worker, throwing factory, concurrent ids, erroring worker, stray id) failed on that rejection, i.e. on the planned behavior rather than an import or syntax fault. Semantic assessment: valid RED. The static-safety suite passed at RED because it guards code already written in Task 1 and the unchanged package.json; it is a regression lock, not new behavior. `workflow.tdd_mode` is not enabled in config, so the `tdd-red-evidence` classifier was not run.
- GREEN (`08f853f`): all 13 tracer tests, 7 static tests and the 19-file suite pass.
- REFACTOR: none needed.

## Files Created/Modified
- `src/ui/cases.ts` - bundled incidents via `?raw` imports and manifests; carries the `vite/client` reference
- `src/worker/protocol.ts` - request/response types, `isAnalyzeRequest`, `toAnalysisFailure`, `handleAnalyzeRequest`
- `src/worker/analyze.worker.ts` - module worker entry
- `src/ui/analysis-client.ts` - worker client with main-thread fallback
- `src/ui/dom.ts` - `el`, `svgEl`, `clear`, `icon`, `SVG_NS`
- `src/ui/view-model.ts` - `deriveResultKind`, `buildVerdictView`
- `src/ui/verdict.ts` - verdict headline renderer
- `src/ui/app.ts` - console controller (`mountApp`, latest-load-wins)
- `index.html`, `src/main.ts`, `vite.config.ts` - shell, bootstrap, `worker.format: 'es'`
- `tests/ui/tracer.test.ts`, `tests/ui/static-safety.test.ts` - 13 + 7 tests

## Decisions Made
- Shared `handleAnalyzeRequest` for worker and fallback keeps both paths byte-identical.
- `Worker` construction is wrapped with a cast to `WorkerLike` after the literal `new Worker(new URL(...), { type: 'module' })` so Vite still detects the worker pattern.
- Client request ids are independent of the app-level `loadId`, which decides which response may render.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `src/styles.css` still carries Phase 1 selectors (`.hero`, `.eyebrow`, `.status-card`, ...) that no longer match any markup; the new classes (`.verdict-*`, `.case-button`, `.site-header`) are unstyled until Plan 04-02 delivers the visual system. This is the planned split, not a defect.
- The first build after Task 1 and the page itself were not exercised in a real browser in this plan; the node-environment tests cover pure modules only.

## Known Stubs

None. (The interface-only `analysis-client.ts` stub existed only between the RED and GREEN commits.)

## Threat Flags

None - no new network endpoint, auth path or trust-boundary file access beyond the plan's threat model (T-04-01 to T-04-05 mitigations are implemented and tested).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for Plan 04-02 (page state machine, status banner, visual system). The protocol shapes, client and view-model entry points are in place for it and for the later regions.

## Self-Check: PASSED

All 13 plan files exist; commits `bc4bfa6`, `2389494`, `08f853f` are ancestors of HEAD; `npm run typecheck`, `npm test` (19 files, 210 tests) and `npm run build` pass; `dist/assets` contains `analyze.worker-*.js`.

---
*Phase: 04-incident-console-and-investigation-flow*
*Completed: 2026-10-19*
