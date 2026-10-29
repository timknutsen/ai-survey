# Work friction survey

Five-question survey about work friction and AI, designed to take about three minutes and stay under five. Static site (GitHub Pages), answers saved to Supabase. No login.

## Questions

1. How often do you use AI at work?
2. Which AI tools do you currently use? (Up to three.)
3. What is one task you would like to spend less time on?
4. What holds you back from using AI more? (Up to three.)
5. Would you like help trying AI on a real task?

Four questions use quick choices; one asks for a short written example. All questions can be skipped. Optional name and team fields are at the start; follow-up contact is optional on the final question. Frequency distinguishes Daily (about once a day) from Many times a day. The tool question shows a full list, including Claude Science, plus Other text and an exclusive None yet option. At most three tools can be selected. Barriers allow up to three selections and include AI potential and the complexity of life-science tools. The tool list is grouped into general assistants, research and life sciences, and coding. The previous card exercise and archetype result have been removed.

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

Version 4 writes `frequency`, `tools`, `tools_other` (when Other is selected), `time_sink`, `barriers` and `demo`. Barriers are stored as an array of up to three selections; optional details use `barriers_other`. New responses include `_survey_version: 4` in `answers` and have no archetype. The owner-only flat view appends `tools`, `tools_other` and `survey_version` columns. The write RPC and table are unchanged. Existing view columns remain in their original order and older question columns will be blank for new responses.

The version 4 reset starts a fresh response with a new id and does not reuse earlier browser progress. Browser progress for new responses is stored under `friction-survey-v4`. Older open tabs should be refreshed before answering the new survey.

The anon key can only call `save_ai_survey_response`; it cannot read or list responses.

## Temporary public results dashboard

The unlisted dashboard at `/ai-survey/dashboard/` loads aggregate counts without sign-in and refreshes every 30 seconds. The page requests that search engines do not index it, but the URL and aggregate API are public and discoverable. Anyone can access these counts.

The dashboard function returns no names, contact details, identifiers, or free-text answers. Tool and barrier values are limited to known survey choices, with other values grouped as `Other`. Small aggregate counts may still reveal information about individuals.

Task examples are summarized as overlapping themes using keyword rules in the database function. Counts are per completed response with a nonempty example. An example can contribute to several themes; examples matching none are counted as `Not classified`. The original wording is never returned to the dashboard.

`dashboard/aggregate.sql` defines the temporary public aggregate function. Completed responses are used for charts; the in-progress count is shown separately. Counts are responses, not necessarily unique people. Raw response tables and views remain unavailable to the public key.
