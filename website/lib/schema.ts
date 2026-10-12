import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const session = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);
export const verification = pgTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").default("Acme Studio").notNull(),
  setupVersion: integer("setup_version").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
const tenantId = () =>
  text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });
export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company").notNull(),
    role: text("role").notNull(),
    status: text("status").$type<"lead" | "active" | "customer">().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("contacts_tenant_idx").on(t.tenantId)],
);
export const deals = pgTable(
  "deals",
  {
    id: text("id").primaryKey(),
    tenantId: tenantId(),
    title: text("title").notNull(),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    value: integer("value").notNull(),
    stage: text("stage")
      .$type<"qualified" | "proposal" | "negotiation" | "won" | "lost">()
      .notNull(),
    closeDate: timestamp("close_date").notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("deals_tenant_idx").on(t.tenantId)],
);
export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    tenantId: tenantId(),
    title: text("title").notNull(),
    dueDate: timestamp("due_date").notNull(),
    completed: boolean("completed").default(false).notNull(),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("tasks_tenant_idx").on(t.tenantId)],
);
export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    tenantId: tenantId(),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    type: text("type").$type<"note" | "deal" | "task" | "contact">().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("activities_tenant_idx").on(t.tenantId)],
);

export const agentBuckets = pgTable(
  "agent_buckets",
  {
    key: text("key").primaryKey(),
    tokens: integer("tokens").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
    requests: integer("requests").notNull(),
    requestResetAt: timestamp("request_reset_at", { withTimezone: true }).notNull(),
    leaseId: text("lease_id"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("agent_buckets_reset_idx").on(t.resetAt)],
);
