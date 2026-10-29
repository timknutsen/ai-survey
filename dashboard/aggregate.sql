-- Aggregate-only dashboard. The verified owner can read counts, never response rows.
create or replace function public.ai_survey_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'timknutsen@gmail.com'
      and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false)
  ) then
    raise exception 'Dashboard access denied' using errcode = '42501';
  end if;

  return (
    with responses as (
      select id, completed, answers from public.ai_survey_responses
    ),
    finished as (
      select id, answers from responses where completed is true
    ),
    frequency as (
      select case when answers->>'frequency' in ('Never','A few times a year','Monthly','Weekly','Daily','Many times a day')
        then answers->>'frequency' else 'Other or unanswered' end as label, count(*) as n
      from finished group by 1
    ),
    tools_per_response as (
      select distinct f.id,
        case when v.value in ('ChatGPT','Claude','Claude Science','Gemini','Microsoft Copilot','Grok','DeepSeek',
          'Mistral Le Chat','Meta AI','Poe','NotebookLM','Perplexity','Elicit','Consensus','scite',
          'ResearchRabbit','Semantic Scholar','SciSpace','Scholarcy','Connected Papers','Litmaps','AlphaFold',
          'GitHub Copilot','Codex','Cursor','Windsurf','Replit AI','Other','None yet')
          then v.value else 'Other' end as label
      from finished f cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(f.answers->'tools')='array' then f.answers->'tools' else '[]'::jsonb end) v(value)
    ),
    tools as (select label,count(*) as n from tools_per_response group by 1),
    barriers_per_response as (
      select distinct f.id,
        case when v.value in ('I don''t understand AI''s real potential','Life-science tools feel too complicated',
          'Not knowing where to start','Accuracy / trust','Confidentiality / data concerns','Access to suitable tools',
          'Time to learn','Nothing','Other') then v.value else 'Other' end as label
      from finished f cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(f.answers->'barriers')='array' then f.answers->'barriers' else '[]'::jsonb end) v(value)
    ),
    barriers as (select label,count(*) as n from barriers_per_response group by 1),
    follow_up as (
      select case when answers->>'demo' in ('Yes','Maybe','No') then answers->>'demo' else 'No answer' end as label,
        count(*) as n from finished group by 1
    ),
    task_examples as (
      select id, lower(trim(answers->>'time_sink')) as task
      from finished where length(trim(coalesce(answers->>'time_sink',''))) > 0
    ),
    theme_rules(label, pattern) as (
      values
        ('Writing and reporting', 'report|rapport|presentations?|presentasjoner?|applications?|søknad|skriv'),
        ('Finding and reviewing information', 'search|søk|literatur|papers?|articles?|published|documents?|dokument|files?|contracts?|looking|lookup|fishtalk|patent'),
        ('Data preparation and analysis', 'data|spreadsheet|regneark|koblingsfil|analys|statistics|statistikk|genotype|fishtalk|pathway'),
        ('Samples and traceability', 'fish.?groups?|genotype|prøver|prøve|samples?|shipments?|innsending|skjema|forms?'),
        ('Coding and scripts', 'cod(e|ing|es)|scripts?|kode|programmer|pipeline'),
        ('Planning and coordination', 'meetings?|møte|organize my day|organise my day|planlegging|coordinat|schedule'),
        ('Using AI tools', 'gpt|prompt|ai tool|kunstig intelligens')
    ),
    task_matches as (
      select t.id, r.label from task_examples t cross join theme_rules r where t.task ~ r.pattern
    ),
    task_themes as (
      select label, count(distinct id) as n from task_matches group by label
      union all
      select 'Not classified', count(*) from task_examples t
      where not exists (select 1 from task_matches m where m.id = t.id)
      having count(*) > 0
    )
    select jsonb_build_object(
      'generated_at', now(),
      'completed', (select count(*) from finished),
      'partial', (select count(*) from responses where completed is false),
      'task_examples', (select count(*) from finished where length(trim(coalesce(answers->>'time_sink',''))) > 0),
      'task_themes', (select coalesce(jsonb_agg(to_jsonb(task_themes) order by n desc, label),'[]'::jsonb) from task_themes),
      'frequency', (select coalesce(jsonb_agg(to_jsonb(frequency) order by n desc, label),'[]'::jsonb) from frequency),
      'tools', (select coalesce(jsonb_agg(to_jsonb(tools) order by n desc, label),'[]'::jsonb) from tools),
      'barriers', (select coalesce(jsonb_agg(to_jsonb(barriers) order by n desc, label),'[]'::jsonb) from barriers),
      'follow_up', (select coalesce(jsonb_agg(to_jsonb(follow_up) order by n desc, label),'[]'::jsonb) from follow_up)
    )
  );
end;
$$;
revoke all on function public.ai_survey_dashboard() from public, anon, authenticated;
grant execute on function public.ai_survey_dashboard() to authenticated;
