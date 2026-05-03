-- PaperBank schema — run this once in Supabase SQL Editor

create table if not exists papers (
  id           text primary key,
  filename     text not null,
  subject      text not null,
  subject_code text not null,
  year         text not null,
  session      text not null,
  paper_number text not null,
  component    text not null,
  question_count int default 0,
  uploaded_at  timestamptz default now()
);

create table if not exists questions (
  id            text primary key,
  paper_id      text not null references papers(id) on delete cascade,
  subject       text not null,
  subject_code  text not null,
  year          text not null,
  session       text not null,
  paper_number  text not null,
  component     text not null,
  question_number text not null,
  text          text not null,
  marks         int,
  tags          text[] default '{}',
  created_at    timestamptz default now()
);

-- Indexes for fast filtering
create index if not exists idx_questions_subject  on questions(subject);
create index if not exists idx_questions_year     on questions(year);
create index if not exists idx_questions_paper_id on questions(paper_id);
create index if not exists idx_questions_tags     on questions using gin(tags);

-- Full text search index
create index if not exists idx_questions_fts on questions using gin(to_tsvector('english', text));
