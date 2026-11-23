PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    display_name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    default_region TEXT NOT NULL DEFAULT 'CN',
    default_currency TEXT NOT NULL DEFAULT 'CNY',
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_channels (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_channels_user
    ON billing_channels(user_id, is_active, name);

CREATE TABLE IF NOT EXISTS catalog_services (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '',
    website_domain TEXT,
    logo_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_services_name
    ON catalog_services(name);

CREATE TABLE IF NOT EXISTS catalog_prices (
    id TEXT PRIMARY KEY NOT NULL,
    service_id TEXT NOT NULL REFERENCES catalog_services(id) ON DELETE CASCADE,
    region TEXT NOT NULL,
    platform TEXT,
    plan_name TEXT NOT NULL,
    billing_interval_count INTEGER NOT NULL DEFAULT 1,
    billing_interval_unit TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    source_name TEXT,
    source_url TEXT,
    verified_at TEXT,
    fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, region, platform, plan_name, billing_interval_count, billing_interval_unit, currency)
);

CREATE INDEX IF NOT EXISTS idx_catalog_prices_service_region
    ON catalog_prices(service_id, region);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    catalog_service_id TEXT REFERENCES catalog_services(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    category TEXT,
    amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
    currency TEXT NOT NULL,
    billing_interval_count INTEGER NOT NULL DEFAULT 1 CHECK (billing_interval_count > 0),
    billing_interval_unit TEXT NOT NULL CHECK (billing_interval_unit IN ('day', 'week', 'month', 'year', 'once')),
    billing_anchor_date TEXT,
    next_billing_date TEXT NOT NULL,
    renewal_method TEXT NOT NULL CHECK (renewal_method IN ('auto', 'manual')),
    billing_channel_id TEXT REFERENCES billing_channels(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
    management_url TEXT,
    notes TEXT,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
    ON subscriptions(user_id, status, next_billing_date);

CREATE TABLE IF NOT EXISTS payment_records (
    id TEXT PRIMARY KEY NOT NULL,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    billing_period_date TEXT NOT NULL,
    paid_at TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
    currency TEXT NOT NULL,
    billing_channel_name TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subscription_id, billing_period_date)
);

CREATE INDEX IF NOT EXISTS idx_payment_records_subscription
    ON payment_records(subscription_id, billing_period_date);

CREATE INDEX IF NOT EXISTS idx_payment_records_paid_at
    ON payment_records(paid_at);
