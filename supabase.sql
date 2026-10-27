-- Run once in the Supabase SQL editor.
-- Respondents can only write through save_ai_survey_response(); the anon key
-- cannot read, list or delete anything. Read results in the dashboard.

create table if not exists public.ai_survey_responses (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text,
  team        text,
  contact     text,
  step        int,
  completed   boolean not null default false,
  archetype   text,
  answers     jsonb not null default '{}'::jsonb,
  user_agent  text
);

alter table public.ai_survey_responses enable row level security;
-- No policies on purpose: anon/authenticated get no direct table access.
revoke all on public.ai_survey_responses from anon, authenticated;

create or replace function public.save_ai_survey_response(
  p_id uuid,
  p_name text,
  p_team text,
  p_contact text,
  p_step int,
  p_completed boolean,
  p_archetype text,
  p_answers jsonb,
  p_user_agent text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_answers::text) > 50000 then
    raise exception 'answers too large';
  end if;

  insert into public.ai_survey_responses
    (id, name, team, contact, step, completed, archetype, answers, user_agent)
  values
    (p_id, left(p_name, 200), left(p_team, 200), left(p_contact, 200), p_step,
     coalesce(p_completed, false), left(p_archetype, 100), coalesce(p_answers, '{}'::jsonb), left(p_user_agent, 300))
  on conflict (id) do update set
    name       = excluded.name,
    team       = excluded.team,
    contact    = excluded.contact,
    step       = greatest(ai_survey_responses.step, excluded.step),
    completed  = ai_survey_responses.completed or excluded.completed,
    archetype  = coalesce(excluded.archetype, ai_survey_responses.archetype),
    answers    = excluded.answers,
    user_agent = excluded.user_agent,
    updated_at = now();
end;
$$;

revoke all on function public.save_ai_survey_response(uuid, text, text, text, int, boolean, text, jsonb, text) from public;
grant execute on function public.save_ai_survey_response(uuid, text, text, text, int, boolean, text, jsonb, text) to anon, authenticated;

-- Handy flat view for reading/exporting (owner only; not exposed to anon).
create or replace view public.ai_survey_flat with (security_invoker = true) as
select
  created_at, updated_at, completed, name, team, contact, archetype,
  answers->>'frequency'                         as frequency,
  (select string_agg(x, '; ') from jsonb_array_elements_text(answers->'uses') x)     as uses,
  answers->>'uses_other'                        as uses_other,
  answers->>'time_sink'                         as time_sink,
  answers->'familiar'                           as familiar_cards,
  answers->>'never_again'                       as never_again,
  answers->>'last_bad_day'                      as last_bad_day,
  answers->>'ai_better'                         as ai_better,
  (select string_agg(x, '; ') from jsonb_array_elements_text(answers->'barriers') x) as barriers,
  answers->>'barriers_other'                    as barriers_other,
  answers->>'demo'                              as demo,
  answers->>'open'                              as open_prompt,
  id
from public.ai_survey_responses
order by created_at;

revoke all on public.ai_survey_flat from anon, authenticated;
