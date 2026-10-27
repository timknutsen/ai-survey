# Work friction survey

Five-question survey about work friction and AI, designed to take about three minutes and stay under five. Static site (GitHub Pages), answers saved to Supabase. No login.

## Questions

1. How often do you use AI at work?
2. Which AI tools do you currently use? (Up to three.)
3. What is one task you would like to spend less time on?
4. What is your main barrier to using AI?
5. Would you like help trying AI on a real task?

Four questions use quick choices; one asks for a short written example. All questions can be skipped. Optional name and team fields are at the start; follow-up contact is optional on the final question. Frequency distinguishes Daily (about once a day) from Many times a day. The tool question shows a full list, including Claude Science, plus Other text and an exclusive None yet option. At most three tools can be selected. The main barrier is a single choice and includes AI potential and the complexity of life-science tools. The previous card exercise and archetype result have been removed.

## Setup

1. Create a Supabase project (pick an EU region, e.g. Stockholm or Frankfurt).
2. SQL editor: run `supabase.sql`.
3. Project Settings → API: copy the Project URL and the anon / publishable key into `config.js`.
4. Push; GitHub Pages serves the repo root.

## Sending it out

- Plain link: `https://timknutsen.no/ai-survey/`
- Pre-filled name/team: `https://timknutsen.no/ai-survey/?name=Kari%20Nordmann&team=Genetics`

Each browser gets a random response id; answers are saved after changes and navigation, so partial responses are kept (`completed = false`, `step` shows how far they got). Refreshing resumes where they left off. A failed submission shows a retry action; the confirmation only says the response is saved after the server accepts it.

## Reading results

Supabase → Table editor → `ai_survey_flat` (one row per response, flattened), or export to CSV. Raw answers sit in `ai_survey_responses.answers` (jsonb).

Version 3 writes `frequency`, `tools`, `tools_other` (when Other is selected), `time_sink`, `barriers` and `demo`. The main barrier remains an array with one selected answer; optional details use `barriers_other`. New responses include `_survey_version: 3` in `answers` and have no archetype. The owner-only flat view appends `tools`, `tools_other` and `survey_version` columns. The write RPC and table are unchanged. Existing view columns remain in their original order and older question columns will be blank for new responses.

Existing database responses are preserved. Completed version 1 and 2 responses still open on the thank-you screen and are not posted again. Starting a new response creates a new id. An unfinished older draft stays untouched; the revised survey starts separately. Browser progress is stored under `friction-survey-v3`.

The anon key can only call `save_ai_survey_response`; it cannot read or list responses.
