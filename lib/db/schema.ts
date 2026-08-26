import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "editor"]);
export const platform = pgEnum("platform", ["meta", "google_ads", "ga4"]);
export const connectedAccountStatus = pgEnum("connected_account_status", [
  "active",
  "error",
  "pending",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("editor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loginRateLimits = pgTable("login_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const connectedAccounts = pgTable("connected_accounts", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  platform: platform("platform").notNull(),
  externalId: text("external_id").notNull(),
  displayName: text("display_name").notNull(),
  timezone: text("timezone").notNull().default("America/Montevideo"),
  currency: text("currency").notNull().default("USD"),
  conversionActionType: text("conversion_action_type"),
  status: connectedAccountStatus("status").notNull().default("pending"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgCredentials = pgTable(
  "org_credentials",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    platform: platform("platform").notNull(),
    encryptedPayload: jsonb("encrypted_payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.organizationId, table.platform)],
);

export const dailyMetricValues = pgTable(
  "daily_metric_values",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    connectedAccountId: uuid("connected_account_id")
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    metricKey: text("metric_key").notNull(),
    value: numeric("value").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.connectedAccountId, table.date, table.metricKey)],
);

export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  connectedAccountId: uuid("connected_account_id")
    .notNull()
    .references(() => connectedAccounts.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  errorMessage: text("error_message"),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  clients: many(clients),
  credentials: many(orgCredentials),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  connectedAccounts: many(connectedAccounts),
}));

export const orgCredentialsRelations = relations(orgCredentials, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgCredentials.organizationId],
    references: [organizations.id],
  }),
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({ one, many }) => ({
  client: one(clients, {
    fields: [connectedAccounts.clientId],
    references: [clients.id],
  }),
  dailyMetricValues: many(dailyMetricValues),
  syncLogs: many(syncLogs),
}));

export const dailyMetricValuesRelations = relations(dailyMetricValues, ({ one }) => ({
  connectedAccount: one(connectedAccounts, {
    fields: [dailyMetricValues.connectedAccountId],
    references: [connectedAccounts.id],
  }),
}));

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  connectedAccount: one(connectedAccounts, {
    fields: [syncLogs.connectedAccountId],
    references: [connectedAccounts.id],
  }),
}));
