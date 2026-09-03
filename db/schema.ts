import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const visits = sqliteTable("visits", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  service: text("service").notNull(),
  subtype: text("subtype").notNull(),
  location: text("location").notNull(),
  documentsConfirmed: integer("documents_confirmed").notNull().default(0),
  status: text("status").notNull().default("ready"),
  queueNumber: text("queue_number"),
  serviceCounter: text("service_counter"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_visits_code").on(table.code),
  uniqueIndex("idx_visits_queue_number").on(table.queueNumber),
]);

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  visitCode: text("visit_code").notNull(),
  rating: integer("rating").notNull(),
  issue: text("issue").notNull().default("none"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_feedback_visit_code").on(table.visitCode),
]);
