-- Dates en millisecondes depuis l'epoch (l'horloge est injectable dans les tests).

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  created_at    INTEGER NOT NULL
);

-- On ne stocke que le sha256 du jeton : une fuite de la base ne donne aucune session.
CREATE TABLE sessions (
  token_hash   TEXT    PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- La progression est un document JSON : ajouter un jeu ou un module ne change pas le schéma.
CREATE TABLE progress (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT    NOT NULL CHECK (json_valid(data)),
  rev        INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE cohorts (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  code       TEXT    NOT NULL UNIQUE,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX cohorts_owner ON cohorts(owner_id);

CREATE TABLE cohort_members (
  cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (cohort_id, user_id)
);
CREATE INDEX cohort_members_user ON cohort_members(user_id);

CREATE TABLE reset_tokens (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX reset_tokens_user ON reset_tokens(user_id);
