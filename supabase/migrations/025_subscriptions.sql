-- ============================================================
-- SUBSCRIPTIONS (Stripe billing)
-- ============================================================
create table if not exists subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references users(id) on delete cascade unique,
  store_id                uuid references stores(id),
  stripe_customer_id      text not null,
  stripe_subscription_id  text,
  plan                    text not null default 'free',
  status                  text not null default 'trialing',
  ai_requests_count       integer not null default 0,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- RLS
alter table subscriptions enable row level security;

create policy "Users can read own subscription"
  on subscriptions for select using (auth.uid() = user_id);

create policy "Service can manage subscriptions"
  on subscriptions for all using (true);
