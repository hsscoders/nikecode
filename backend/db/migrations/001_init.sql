-- ============================================================
-- NIKECODE 001 — initial MySQL schema (from MongoDB models)
-- Target: MySQL 5.7/8 + MariaDB 10.4+ (cPanel compatible)
--   * utf8mb4_unicode_ci — portable collation
--   * DECIMAL(12,2) money — no float drift
--   * legacy_id CHAR(24) — the original MongoDB _id, kept for
--     webhook continuity (old pending gateway orders) and audit
--   * money columns are UNSIGNED except where admin edits could
--     transiently need negatives (none — debits are floor-guarded)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id        CHAR(24)     NULL,
  phone            VARCHAR(10)  NOT NULL,
  password         VARCHAR(100) NOT NULL,
  withdraw_password VARCHAR(100) NOT NULL,
  ref_by           VARCHAR(20)  NOT NULL DEFAULT '',
  userid           VARCHAR(20)  NULL,
  ref_id           VARCHAR(20)  NULL,
  name             VARCHAR(40)  NOT NULL DEFAULT '',
  balance          DECIMAL(12,2) NOT NULL DEFAULT 0,
  recharge_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_recharge   DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_income     DECIMAL(12,2) NOT NULL DEFAULT 0,
  status           ENUM('Active','Banned') NOT NULL DEFAULT 'Active',
  bank_real_name   VARCHAR(30)  NOT NULL DEFAULT '',
  bank_bank_name   VARCHAR(30)  NOT NULL DEFAULT '',
  bank_account     VARCHAR(24)  NOT NULL DEFAULT '',
  bank_ifsc        VARCHAR(11)  NOT NULL DEFAULT '',
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_phone (phone),
  UNIQUE KEY uq_users_legacy (legacy_id),
  UNIQUE KEY uq_users_userid (userid),
  UNIQUE KEY uq_users_refid (ref_id),
  KEY ix_users_ref_by (ref_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id  CHAR(24)     NULL,
  username   VARCHAR(40)  NOT NULL,
  password   VARCHAR(100) NOT NULL,
  name       VARCHAR(60)  NOT NULL DEFAULT 'Administrator',
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_username (username),
  UNIQUE KEY uq_admins_legacy (legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plans (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id     CHAR(24)     NULL,
  name          VARCHAR(60)  NOT NULL,
  vip           TINYINT(1)   NOT NULL DEFAULT 0,
  image         VARCHAR(500) NOT NULL DEFAULT '',
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,
  daily         DECIMAL(12,2) NOT NULL DEFAULT 0,
  cycle         INT UNSIGNED NOT NULL DEFAULT 1,
  total         DECIMAL(12,2) NOT NULL DEFAULT 0,
  purchase_limit INT UNSIGNED NOT NULL DEFAULT 0,  -- JS attr `limit` (0 = unlimited)
  presale       TINYINT(1)   NOT NULL DEFAULT 0,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  sort          INT          NOT NULL DEFAULT 0,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_legacy (legacy_id),
  KEY ix_plans_active_sort (active, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banners (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id  CHAR(24)     NULL,
  title      VARCHAR(80)  NOT NULL DEFAULT '',
  image      VARCHAR(500) NOT NULL,
  origin_url VARCHAR(500) NOT NULL DEFAULT '',
  link       VARCHAR(500) NOT NULL DEFAULT '',
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  sort       INT          NOT NULL DEFAULT 0,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_banners_legacy (legacy_id),
  KEY ix_banners_active_sort (active, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Single-row-per-key JSON settings (the app reads/writes the whole
-- object; admin routes mutate nested sections). JSON type maps to
-- LONGTEXT on MariaDB — the model getter parses both shapes.
CREATE TABLE IF NOT EXISTS settings (
  `key`      VARCHAR(40)  NOT NULL,
  data       JSON         NOT NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deposits (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id        CHAR(24)     NULL,
  user_id          INT UNSIGNED NULL,
  userid           VARCHAR(20)  NOT NULL DEFAULT '',
  phone            VARCHAR(10)  NOT NULL DEFAULT '',
  amount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  method           VARCHAR(40)  NOT NULL DEFAULT 'Pay-T',
  status           ENUM('Pending','Success','Rejected') NOT NULL DEFAULT 'Pending',
  note             VARCHAR(255) NOT NULL DEFAULT '',
  processed_at     DATETIME(3)  NULL,
  gateway          VARCHAR(40)  NOT NULL DEFAULT '',
  gateway_order_id VARCHAR(64)  NOT NULL DEFAULT '',
  payment_url      VARCHAR(500) NOT NULL DEFAULT '',
  utr              VARCHAR(64)  NOT NULL DEFAULT '',
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_deposits_legacy (legacy_id),
  KEY ix_deposits_user (user_id),
  KEY ix_deposits_phone (phone),
  KEY ix_deposits_status (status),
  KEY ix_deposits_gw_order (gateway_order_id),
  CONSTRAINT fk_deposits_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS withdrawals (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id        CHAR(24)     NULL,
  user_id          INT UNSIGNED NULL,
  userid           VARCHAR(20)  NOT NULL DEFAULT '',
  phone            VARCHAR(10)  NOT NULL DEFAULT '',
  amount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  charge_percent   DECIMAL(5,2) NOT NULL DEFAULT 0,
  charge           DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  real_name        VARCHAR(30)  NOT NULL DEFAULT '',
  bank_name        VARCHAR(30)  NOT NULL DEFAULT '',
  account          VARCHAR(24)  NOT NULL DEFAULT '',
  ifsc             VARCHAR(11)  NOT NULL DEFAULT '',
  status           ENUM('Pending','Processing','Success','Rejected') NOT NULL DEFAULT 'Pending',
  note             VARCHAR(255) NOT NULL DEFAULT '',
  processed_at     DATETIME(3)  NULL,
  auto_payout      TINYINT(1)   NOT NULL DEFAULT 0,
  gateway          VARCHAR(40)  NOT NULL DEFAULT '',
  payout_order_id  VARCHAR(64)  NOT NULL DEFAULT '',
  gateway_order_id VARCHAR(64)  NOT NULL DEFAULT '',
  utr              VARCHAR(64)  NOT NULL DEFAULT '',
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_withdrawals_legacy (legacy_id),
  KEY ix_withdrawals_user (user_id),
  KEY ix_withdrawals_phone (phone),
  KEY ix_withdrawals_status (status),
  KEY ix_withdrawals_payout_order (payout_order_id),
  CONSTRAINT fk_withdrawals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id     CHAR(24)     NULL,
  user_id       INT UNSIGNED NULL,
  userid        VARCHAR(20)  NOT NULL DEFAULT '',
  phone         VARCHAR(10)  NOT NULL DEFAULT '',
  type          ENUM('recharge','withdraw','commission','income','bonus','invest') NOT NULL DEFAULT 'recharge',
  title         VARCHAR(60)  NOT NULL DEFAULT '',
  method        VARCHAR(120) NOT NULL DEFAULT '',
  amount        DECIMAL(12,2) NOT NULL DEFAULT 0,
  charge_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  charge        DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  status        ENUM('Pending','Processing','Success','Rejected') NOT NULL DEFAULT 'Pending',
  ref_id        VARCHAR(64)  NOT NULL DEFAULT '',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_legacy (legacy_id),
  KEY ix_transactions_user (user_id),
  KEY ix_transactions_phone (phone),
  KEY ix_transactions_type (type),
  KEY ix_transactions_ref (ref_id),
  KEY ix_transactions_userid (userid),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invests (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id  CHAR(24)     NULL,
  user_id    INT UNSIGNED NULL,
  userid     VARCHAR(20)  NOT NULL DEFAULT '',
  phone      VARCHAR(10)  NOT NULL DEFAULT '',
  plan_id    INT UNSIGNED NULL,          -- SET NULL: plans can be deleted (Mongo allowed it)
  plan_name  VARCHAR(60)  NOT NULL,
  vip        TINYINT(1)   NOT NULL DEFAULT 0,
  price      DECIMAL(12,2) NOT NULL DEFAULT 0,
  daily      DECIMAL(12,2) NOT NULL DEFAULT 0,
  cycle      INT UNSIGNED NOT NULL DEFAULT 1,
  total      DECIMAL(12,2) NOT NULL DEFAULT 0,
  status     ENUM('Active','Completed') NOT NULL DEFAULT 'Active',
  paid_days  INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_invests_legacy (legacy_id),
  KEY ix_invests_user (user_id),
  KEY ix_invests_phone (phone),
  KEY ix_invests_status (status),
  KEY ix_invests_plan (plan_id),
  CONSTRAINT fk_invests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_invests_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id   CHAR(24)     NULL,
  actor_type  ENUM('admin','user','system') NOT NULL,
  actor_id    VARCHAR(40)  NOT NULL DEFAULT '',
  actor_label VARCHAR(60)  NOT NULL DEFAULT '',
  action      VARCHAR(60)  NOT NULL,
  category    ENUM('auth','deposit','withdraw','invest','user','plan','banner','settings','gateway','system') NOT NULL,
  target      VARCHAR(120) NOT NULL DEFAULT '',
  message     VARCHAR(400) NOT NULL DEFAULT '',
  detail      JSON         NULL,
  ip          VARCHAR(64)  NOT NULL DEFAULT '',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_audit_legacy (legacy_id),
  KEY ix_audit_created (created_at),
  KEY ix_audit_actor_type (actor_type),
  KEY ix_audit_action (action),
  KEY ix_audit_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_codes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id  CHAR(24)     NULL,
  code       CHAR(48)     NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  used       TINYINT(1)   NOT NULL DEFAULT 0,
  used_at    DATETIME(3)  NULL,
  expires_at DATETIME(3)  NOT NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_login_codes_code (code),
  UNIQUE KEY uq_login_codes_legacy (legacy_id),
  KEY ix_login_codes_user (user_id),
  CONSTRAINT fk_login_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration bookkeeping (used by db/migrate.js)
CREATE TABLE IF NOT EXISTS _migrations (
  name       VARCHAR(100) NOT NULL,
  applied_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
