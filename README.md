# Work friction survey

Five-question survey about work friction and AI, designed to take about three minutes and stay under five. Static site (GitHub Pages), answers saved to Supabase. No login.

## Questions

1. How often do you use AI at work?
2. What is one task you would like to spend less time on?
3. What would you most like AI to help with?
4. What is your main barrier to using AI?
5. Would you like help trying AI on a real task?

Four questions use quick choices; one asks for a short written example. All questions can be skipped. Name, team and follow-up contact are optional on the final question. The previous card exercise and archetype result have been removed.

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

Version 2 writes the existing `frequency`, `time_sink`, `ai_better`, `barriers` and `demo` fields; `barriers` remains an array with one selected answer. Other text for the help question is included directly in `ai_better`; barrier details use `barriers_other`. New responses include `_survey_version: 2` in `answers` and have no archetype. No SQL changes are required. The flat view's older question columns will be blank for new responses.

Existing database responses are preserved. Completed version 1 responses still open on the thank-you screen and are not posted again. Starting a new response creates a new id. An unfinished version 1 draft stays untouched; the shortened survey starts separately. Browser progress is stored under `friction-survey-v2`.

The anon key can only call `save_ai_survey_response`; it cannot read or list responses.
