CREATE TABLE IF NOT EXISTS app_data (
    key TEXT PRIMARY KEY CHECK (key IN ('accounts', 'reports', 'budget', 'reports_meta', 'budget_meta')),
    json TEXT NOT NULL CHECK (json_valid(json))
) STRICT;

CREATE TABLE IF NOT EXISTS accounts (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    oauth_provider TEXT,
    oauth_id TEXT,
    extra_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra_json))
) STRICT;

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    status TEXT,
    category TEXT,
    province TEXT,
    created_at TEXT,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
) STRICT;
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
CREATE INDEX IF NOT EXISTS reports_category_idx ON reports(category);
CREATE INDEX IF NOT EXISTS reports_province_idx ON reports(province);

CREATE TABLE IF NOT EXISTS provinces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
) STRICT;

CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL CHECK (json_valid(value_json))
) STRICT;
