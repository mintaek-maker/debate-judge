-- 논쟁 심판 앱 Supabase 테이블 생성 SQL
-- Supabase 대시보드의 SQL Editor에서 실행하세요.

create table verdicts (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  person_a text not null,
  person_b text not null,
  argument_a text not null,
  argument_b text not null,
  relation_type text not null,
  severity int not null,
  case_title text,
  winner text,
  score_a int,
  score_b int,
  judge_comment text,
  verdict_reason text,
  tag text,
  severity_badge text,
  reconciliation_tip text,
  hearts int default 0
);

-- Row Level Security 활성화
alter table verdicts enable row level security;

-- 누구나 읽기 가능
create policy "public read" on verdicts
  for select using (true);

-- 누구나 삽입 가능
create policy "public insert" on verdicts
  for insert with check (true);

-- 누구나 hearts 업데이트 가능
create policy "public update hearts" on verdicts
  for update using (true) with check (true);
