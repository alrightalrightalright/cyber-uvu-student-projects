REVOKE ALL ON DATABASE thebirthdates FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE thebirthdates TO birthday_app;
GRANT USAGE ON SCHEMA public TO birthday_app;
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE birthdays (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  first_name VARCHAR(80) NOT NULL CHECK(length(first_name)>0),
  last_name VARCHAR(80) NOT NULL CHECK(length(last_name)>0),
  birthdate DATE NOT NULL CHECK(birthdate >= DATE '1900-01-01' AND birthdate <= CURRENT_DATE),
  phone VARCHAR(32) NOT NULL DEFAULT '',
  email VARCHAR(254) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX birthdays_owner_id_idx ON birthdays(owner_id,id);
CREATE TABLE sessions (sid VARCHAR PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL);
CREATE INDEX sessions_expire_idx ON sessions(expire);
CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN ('create','update','delete')),
  target_id INTEGER NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id UUID NOT NULL
);
GRANT SELECT ON users TO birthday_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON birthdays,sessions TO birthday_app;
GRANT INSERT ON audit_events TO birthday_app;
GRANT USAGE ON SEQUENCE birthdays_id_seq,audit_events_id_seq TO birthday_app;
