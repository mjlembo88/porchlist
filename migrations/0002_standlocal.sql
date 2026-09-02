-- StandStrong marketplace schema
create table if not exists stands (
  id text primary key,
  name text not null,
  kind text not null default 'stand',
  access text not null default 'walk-up',
  county text,
  city text,
  address text,
  zip text,
  lat double precision,
  lng double precision,
  pin_quality text not null default 'none',
  hours text,
  phone text,
  email text,
  website text,
  facebook text,
  instagram text,
  products text not null default '',
  notes text,
  source_notes text,
  featured boolean not null default false,
  listed boolean not null default true,
  plan text not null default 'free',
  claim_status text not null default 'unclaimed',
  claimed_name text,
  owner_user_id text,
  venmo_username text,
  zelle_handle text,
  zelle_destination text,
  cashapp_cashtag text,
  paypal_me_slug text,
  pickup_windows text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stands_owner_idx on stands (owner_user_id);
create index if not exists stands_city_idx on stands (city);

create table if not exists items (
  id text primary key,
  stand_id text not null references stands(id) on delete cascade,
  name text not null,
  unit text not null default 'each',
  price_cents integer not null default 0,
  status text not null default 'in',
  photo text,
  preorderable boolean not null default false,
  max_qty integer,
  decrement_on_sale boolean not null default true,
  sort_order integer not null default 0
);
create index if not exists items_stand_idx on items (stand_id);

create table if not exists specials (
  id text primary key,
  stand_id text not null references stands(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id text primary key,
  stand_id text not null references stands(id) on delete cascade,
  nickname text not null,
  rating integer not null default 5,
  body text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists review_replies (
  id text primary key,
  review_id text not null,
  stand_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists review_flags (
  id text primary key,
  review_id text not null,
  stand_id text not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id text primary key,
  stand_id text not null references stands(id) on delete cascade,
  source text not null default 'walkup',
  status text not null default 'open',
  customer_name text,
  pickup_window text,
  note text,
  discount_cents integer not null default 0,
  tax_cents integer not null default 0,
  custom_cents integer not null default 0,
  custom_label text,
  tender text,
  tendered_cents integer,
  change_cents integer,
  total_cents integer not null default 0,
  received_at timestamptz,
  customer_id text,
  created_at timestamptz not null default now()
);
create index if not exists tickets_stand_idx on tickets (stand_id);

create table if not exists ticket_lines (
  id text primary key,
  ticket_id text not null references tickets(id) on delete cascade,
  item_id text,
  name text not null,
  unit text,
  qty integer not null default 1,
  price_cents integer not null default 0
);

create table if not exists board_snapshots (
  id text primary key,
  stand_id text not null,
  payload text not null,
  created_at timestamptz not null default now()
);

create table if not exists stand_messages (
  id text primary key,
  stand_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists owner_inbox (
  id text primary key,
  stand_id text not null,
  nickname text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists owner_requests (
  id text primary key,
  stand_id text not null,
  user_id text not null,
  name text not null,
  phone text,
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id text primary key,
  role text not null default 'shopper',
  display_name text,
  phone text
);

create table if not exists customers (
  id text primary key,
  nickname text not null,
  phone text,
  last_stand_id text,
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value text not null
);
insert into app_settings (key, value) values
  ('shopper_checkout', 'true'),
  ('guest_orders', 'true'),
  ('shopper_messages', 'true')
on conflict (key) do nothing;
