-- Ejecutar una vez en el SQL Editor de Neon (PostgreSQL)
create table if not exists quiz_users (
  user_id text primary key,
  username text unique not null,
  display_name text not null,
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists quiz_responses (
  id serial primary key,
  user_id text not null references quiz_users(user_id) on delete cascade,
  question_id text not null,
  selected_option integer not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists quiz_responses_user_idx on quiz_responses (user_id);
create index if not exists quiz_responses_question_idx on quiz_responses (question_id);
