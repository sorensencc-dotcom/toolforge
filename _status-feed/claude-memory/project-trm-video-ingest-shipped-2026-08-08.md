---
name: project-trm-video-ingest-shipped-2026-08-08
description: trm video ingestion feature built end-to-end via subagent-driven-development and merged to main; 6 hardening follow-ups deliberately deferred to a new session.
metadata: 
  node_type: memory
  type: project
  originSessionId: 54587280-4c87-4c2a-8a56-0d39055165c8
  modified: 2026-08-08T15:22:59.954Z
---

Video ingestion for trm (personal-archive ingestion CLI) shipped and pushed to origin/main at commit `d51f381` (merged at `5b86935`, video work spans `b0a08e0..f425505`, plus two post-merge fixes `6e97d09` temp-dir race, `9db5196` jest timeout).

**What shipped:** ffmpeg/ffprobe/whisper.cpp preflight, video classification, cached ffprobe duration+audio detection, single-invocation ffmpeg frame extraction (3 duration-based strategies), bounded per-video frame Vision-analysis with immediate cleanup, whisper.cpp transcription (via 16kHz mono WAV extraction — whisper.cpp cannot read video containers directly), RawSourceEnvelope `kind:'video'` + `frames` field, orchestration composing transcript+frame-labels into one extraction-runner call, routed through existing failedStore/manifestStore/--retry-failed machinery.

**Process:** 12-task plan (`.planning/scale-ingest/video-ingest/PLAN.md` + `CONTEXT.md`, both git-tracked at those paths on main) executed via superpowers:subagent-driven-development — implementer → task-reviewer → fix-loop per task, then an opus-tier final whole-branch review that caught a real Critical bug no per-task review could see: the whisper.cpp binary name (`whisper`→`whisper-cli`), model format (`.pt`→`ggml-*.bin`), and CLI args were internally inconsistent, and no audio-extraction-to-WAV step existed at all — transcription would never have worked against a real binary. Also caught Vision-failures-on-frames being silently recorded as success (FrameAnalyzer interface dropped the `metadata.error` field ImageAnalyzer's photo path already checks). Both fixed in one fix wave, re-verified.

**Post-merge fix (this session, additional):** the final-review fix wave itself introduced a subtle regression — `Promise.all` on the transcript/frame branches meant the shared temp-dir cleanup could race a still-running sibling branch on partial failure (delete files out from under a live subprocess, or leak the temp dir on Windows EPERM/EBUSY). Fixed by switching to `Promise.allSettled` + explicit rethrow after both settle. Mutation-tested (new test proves cleanup waits: `fs.existsSync(tempDir)` true mid-flight, false only after both branches settle).

**Also found and fixed this session:** repo-wide Jest `testTimeout` (default 5000ms) was too tight for real async work (retry/backoff, concurrency-pool draining, large batch writes) under full-parallel-suite load — was intermittently flaking 4+ different, unrelated test files across separate runs, all passing reliably in isolation. Raised to 15000ms in `jest.config.cjs`. This was blocking clean pushes via the repo's pre-push hook (which reruns the full suite).

**Surprise discovered mid-session:** a commit (`d51f381`, real fix for a genuine pdfjs-dist worker-version-mismatch bug in `fileConvert.ts`) landed directly on `main` from the user's own account while this session was actively working on the same repo/branch — concurrent editing outside this session, not something the session did. Session did NOT touch that file.

**Deliberately not touched:** `src/cli/commands/syncTreatment.ts` has an uncommitted, unrelated in-progress change (a vault-infra-dirs filter for `discoverTopics`) sitting in the working tree — pre-existing before this session started, still there, not mine to decide. Flag to user if it's still uncommitted next session.

**Open follow-ups, explicitly deferred to a new session (user's own list, 2026-08-08):**
1. Duration/size caps on video ingest — no max today, a pathological file can run ffmpeg/whisper indefinitely.
2. Subprocess kill/cancellation verification on timeout — `execFile`'s timeout kills the process, but nothing verifies child processes/temp files fully clean up after a kill (distinct from the temp-dir race already fixed).
3. Per-video metrics — duration, frame count, transcript status, Vision failure count; nothing currently logged/reported per video.
4. Retry/resume without rerunning completed local work — `--retry-failed` currently reprocesses a failed video from scratch (re-probe, re-transcribe, re-extract-frames), no partial-progress resume.
5. Smoke fixtures against REAL binaries — the entire test suite mocks `execFile` for ffmpeg/ffprobe/whisper.cpp; zero validation has ever run against actual binaries. Highest-value gap: this is exactly the class of bug (binary/args/model mismatch) the final review caught by reasoning, not by testing.
6. Dependency version logging — no record of installed ffmpeg/ffprobe/whisper-cli/model versions in debug output, hurts reproducibility when something breaks in the field.

See [[project-trm-willys-overland-partial]] and [[project-trm-ingest-scale-problem]] for related trm ingestion-pipeline context predating this feature.
