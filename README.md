# Work friction survey

One-question-per-screen survey about work friction and AI. Static site (GitHub Pages), answers saved to Supabase. No login.

## Setup

1. Create a Supabase project (pick an EU region, e.g. Stockholm or Frankfurt).
2. SQL editor: run `supabase.sql`.
3. Project Settings → API: copy the Project URL and the anon / publishable key into `config.js`.
4. Push; GitHub Pages serves the repo root.

## Sending it out

- Plain link: `https://timknutsen.github.io/ai-survey/`
- Pre-filled name/team: `https://timknutsen.github.io/ai-survey/?name=Kari%20Nordmann&team=Genetics`

Each browser gets a random response id; answers are saved after every step, so partial responses are kept (`completed = false`, `step` shows how far they got). Refreshing resumes where they left off.

## Reading results

Supabase → Table editor → `ai_survey_flat` (one row per person, flattened), or export to CSV. Raw answers sit in `ai_survey_responses.answers` (jsonb). Card reactions are `do` / `wish` / `na` per card key.

The anon key can only call `save_ai_survey_response`; it cannot read or list responses.
