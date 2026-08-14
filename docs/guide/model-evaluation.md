# Evaluating code and documentation models

This guide turns a model comparison into a repeatable, bounded test. It is for
code implementation, code review, test creation, and technical documentation.
It does not replace modality-specific image, voice, or safety evaluation.

The worked example comes from
[SPIKE-35](../research/SPIKE-35-code-document-model-comparison). Its candidate
set is `gpt-5.6-terra`, `Kimi-K2.7-Code`, `DeepSeek-V4-Pro`,
`Mistral-Large-3`, `grok-4.3`, and `Llama-4-Maverick-17B`.

::: danger Claude is not part of the worked evaluation
Claude Sonnet 5 appears in SPIKE-35 as an informational price and capability
comparison only. It is not approved for deployment, Marketplace purchase, or
evaluation in the worked instance. Do not add it to a run from this guide.
:::

## What this evaluation can prove

Model cards prove that a model accepts code, has a context window, or exposes
tools. They do not prove that it follows this repository's rules, finds real
defects, or produces a safe patch. This evaluation measures those outcomes on a
fixed test packet.

The output is a role decision, not one universal winner:

| Role | Required evidence |
|---|---|
| Documentation writer | No factual inventions, valid sources and links, style compliance, score at least equal to the baseline |
| Code implementer | Correct minimal patch, all deterministic tests pass, no regression or secret exposure |
| Test author | Tests fail before the intended fix, pass after it, and cover the specified behavior rather than implementation trivia |
| Reviewer | Finds every seeded critical defect, high precision, correct severity, and no invented findings |
| Routine worker | Clears the role's correctness gate at materially lower measured cost or latency |

## Freeze the packet before calling a model

Create immutable copies of every input. Record the source commit and a SHA-256
hash for each fixture and prompt. Never point one model at a later working-tree
version than another.

Use four fixtures:

| ID | Fixture | Frozen input | Expected result |
|---|---|---|---|
| `DOC-01` | Documentation edit | One self-contained Markdown section plus its cited sources and repository writing rules | A corrected replacement with no unsupported claims, broken links, or style violations |
| `FIX-01` | Code fix | One bounded PowerShell, Bicep, or TypeScript defect plus deterministic failing tests | A minimal patch that makes the existing test pass without unrelated edits |
| `TEST-01` | Test creation | One stable behavior with implementation and existing test conventions | New deterministic tests that fail when the behavior is broken and pass when it is correct |
| `REVIEW-01` | Seeded review | One fixed diff containing known correctness, security, cost, and maintainability defects | A severity-ranked review that finds the seeded defects without fabricating others |

Do not use a live production incident as a fixture. Synthetic or historical
defects make the expected answer stable and prevent the test from changing real
infrastructure.

## Run controls

Every model gets the same input and permissions:

- Identical system and task prompts, fixture bytes, and repository rules.
- No web access unless the fixture explicitly includes current-source research.
- No Azure writes, git push, deployment, or access to secrets.
- One initial response and at most one correction turn per fixture.
- Maximum 25,000 input tokens and 4,000 completion tokens per turn.
- Temperature and sampling controls fixed wherever the API exposes them.
- Autonomous retries disabled. A failed or throttled request is recorded, not
  silently replayed.
- `gpt-5.6-terra` uses `max_completion_tokens`. `Mistral-Large-3` uses
  `max_tokens`. Confirm the accepted parameter for every other model before the
  first paid run.
- Claude excluded.

Start with `DOC-01` as a smoke test on each model. Run the other three fixtures
only after the request contract, token accounting, and output capture work.

## Hard cost envelope for the worked example

The maximum packet is eight requests per model: four fixtures, each with one
initial response and one correction turn. At 25,000 input and 4,000 completion
tokens per request, one model can consume at most 200,000 input and 32,000 output
tokens.

Using the Global Standard rates measured in SPIKE-35 and ignoring cache discounts
gives this conservative envelope:

| Model | Max input cost | Max output cost | Packet maximum |
|---|---:|---:|---:|
| `gpt-5.6-terra` | $0.400 | $0.384 | $0.784 |
| `Kimi-K2.7-Code` | $0.190 | $0.128 | $0.318 |
| `DeepSeek-V4-Pro` | $0.348 | $0.111 | $0.459 |
| `Mistral-Large-3` | $0.100 | $0.048 | $0.148 |
| `grok-4.3` | $0.250 | $0.080 | $0.330 |
| `Llama-4-Maverick-17B` | $0.050 | $0.032 | $0.082 |
| **All six** | **$1.338** | **$0.783** | **$2.121** |

A 100% retry and metering reserve raises the authorization envelope to $4.242,
still below the $5 hard ceiling. The caller must stop before issuing a request
whose conservative estimate would cross $5. Azure budgets and deployment
capacity do not provide that synchronous stop.

This estimate is valid only for the dated rates in SPIKE-35. Re-read the current
rate card and recompute the table before a later run.

## Score each artifact before revealing the model

Blind review avoids giving the baseline or a favored provider extra credit.
Replace model names with random labels until human scoring is complete.

| Dimension | Weight | Scoring anchor |
|---|---:|---|
| Correctness and completeness | 35% | 5 means fully correct with no material omission; 1 means unusable or harmful |
| Executable verification | 25% | 5 means the required tests pass and directly prove the behavior |
| Instruction and style adherence | 15% | 5 means every repository and task constraint is followed |
| Review precision and recall | 15% | 5 means all seeded defects found with no false positives |
| Actual cost | 5% | Normalize against the least expensive passing run |
| Latency | 5% | Normalize against the fastest passing run |

Apply hard gates before the weighted score:

1. No secret, tenant identifier, or unauthorized write appears in the output.
2. Every required deterministic test passes.
3. Correctness is at least 4 of 5 on every fixture used for the role.
4. `REVIEW-01` misses no seeded critical defect and reaches at least 80% precision.
5. The run stays inside the caller-side token and dollar ceilings.

A run failing any hard gate cannot win a role, regardless of price or aggregate
score.

## Result record

Create one row per model and fixture. Keep raw outputs separately so scoring can
be audited.

| Field | Value |
|---|---|
| Evaluation ID | Stable name such as `code-doc-2026-08-a` |
| Source commit | Full git commit used to freeze fixtures |
| Fixture ID and SHA-256 | Proves identical input |
| Prompt SHA-256 | Proves identical instructions |
| Model deployment and version | Exact callable deployment and model version |
| Start, finish, and latency | UTC timestamps and elapsed milliseconds |
| Input, cached input, reasoning, and output tokens | Record separately when exposed |
| Estimated pre-call cost | Conservative caller ledger value |
| ActualCost | Cost Management value after billing data arrives |
| Test result | Command, exit code, passed, failed, skipped |
| Human scores | Each weighted dimension with short evidence |
| Hard-gate result | Pass or fail, with the failed gate named |
| Notes | Throttling, API incompatibility, truncation, or manual intervention |

Use this comparison table for the final decision:

| Model | DOC-01 | FIX-01 | TEST-01 | REVIEW-01 | Hard gates | Weighted score | Actual cost | Assigned role |
|---|---:|---:|---:|---:|---|---:|---:|---|
| `gpt-5.6-terra` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Baseline |
| `Kimi-K2.7-Code` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `DeepSeek-V4-Pro` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `Mistral-Large-3` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `grok-4.3` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `Llama-4-Maverick-17B` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Stop conditions

Stop the evaluation immediately when:

- the caller ledger reaches the point where the next request could cross $5;
- a client begins retrying autonomously;
- a model ignores or exceeds its completion ceiling;
- fixture or prompt hashes differ between models;
- a request receives access to production credentials or an Azure write path;
- the model endpoint or rate card changes during the run.

Record the partial result. Do not repair a broken comparison by spending through
the gate.

