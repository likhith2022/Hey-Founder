import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getDb, firstCompanyId } from "../db/index.js";
import { requireAuth } from "../security/sessions.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { safeJsonStringify } from "../utils/json.js";
import { sendError, AppError } from "../utils/errors.js";

export const optionalText = z.string().trim().optional().nullable();

export function audit(action: string, resourceType: string, resourceId: string | null, afterState?: unknown, beforeState?: unknown, metadata?: unknown) {
  getDb()
    .prepare("INSERT INTO audit_logs (id, company_id, actor_type, actor_id, action, resource_type, resource_id, before_state, after_state, metadata, created_at) VALUES (?, ?, 'admin', 'local', ?, ?, ?, ?, ?, ?, ?)")
    .run(id("audit"), firstCompanyId(), action, resourceType, resourceId, beforeState ? safeJsonStringify(beforeState) : null, afterState ? safeJsonStringify(afterState) : null, metadata ? safeJsonStringify(metadata) : null, nowIso());
}

type CrudConfig = {
  table: string;
  prefix: string;
  createSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  updateSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  defaultOrder?: string;
  searchable?: string[];
  beforeCreate?: (row: Record<string, unknown>, request: FastifyRequest) => Record<string, unknown>;
  beforeUpdate?: (patch: Record<string, unknown>, before: Record<string, unknown>, request: FastifyRequest) => Record<string, unknown>;
};

export function registerCrud(app: FastifyInstance, path: string, config: CrudConfig) {
  app.get(path, async (request, reply) => {
    try {
      await requireAuth(request);
      const query = request.query as { q?: string; status?: string; company_id?: string; limit?: string };
      const filters: string[] = [];
      const values: unknown[] = [];
      if (query.status && hasColumn(config.table, "status")) {
        filters.push("status = ?");
        values.push(query.status);
      }
      if (query.company_id && hasColumn(config.table, "company_id")) {
        filters.push("company_id = ?");
        values.push(query.company_id);
      }
      if (query.q && config.searchable?.length) {
        filters.push(`(${config.searchable.map((column) => `${column} LIKE ?`).join(" OR ")})`);
        values.push(...config.searchable.map(() => `%${query.q}%`));
      }
      const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
      const order = config.defaultOrder ?? (hasColumn(config.table, "created_at") ? "created_at DESC" : "rowid DESC");
      const limit = Math.min(Number(query.limit ?? 200), 500);
      const rows = getDb().prepare(`SELECT * FROM ${config.table}${where} ORDER BY ${order} LIMIT ?`).all(...values, limit);
      return { data: rows };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get(`${path}/:id`, async (request, reply) => {
    try {
      await requireAuth(request);
      const params = request.params as { id: string };
      const row = getDb().prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(params.id);
      if (!row) throw new AppError("NOT_FOUND", "Resource not found", 404);
      return { data: row };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post(path, async (request, reply) => {
    try {
      await requireAuth(request);
      const body = config.createSchema.parse(request.body);
      const row = config.beforeCreate?.({ id: id(config.prefix), ...body, created_at: nowIso(), updated_at: nowIso() }, request) ?? { id: id(config.prefix), ...body, created_at: nowIso(), updated_at: nowIso() };
      insertRow(config.table, row);
      audit("create", config.table, String(row.id), row);
      return reply.status(201).send({ data: row });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch(`${path}/:id`, async (request, reply) => {
    try {
      await requireAuth(request);
      const params = request.params as { id: string };
      const body = config.updateSchema.parse(request.body);
      const before = getDb().prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(params.id);
      if (!before) throw new AppError("NOT_FOUND", "Resource not found", 404);
      const patch = config.beforeUpdate?.({ ...body, updated_at: nowIso() }, before as Record<string, unknown>, request) ?? { ...body, updated_at: nowIso() };
      updateRow(config.table, params.id, patch);
      const after = getDb().prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(params.id);
      audit("update", config.table, params.id, after, before);
      return { data: after };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete(`${path}/:id`, async (request, reply) => {
    try {
      await requireAuth(request);
      const params = request.params as { id: string };
      const before = getDb().prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(params.id);
      if (!before) throw new AppError("NOT_FOUND", "Resource not found", 404);
      if (hasColumn(config.table, "status")) {
        updateRow(config.table, params.id, { status: "archived", updated_at: nowIso() });
      } else {
        getDb().prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(params.id);
      }
      audit("delete", config.table, params.id, null, before);
      return { ok: true };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}

function hasColumn(table: string, column: string): boolean {
  return (getDb().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((row) => row.name === column);
}

function insertRow(table: string, row: Record<string, unknown>) {
  const entries = Object.entries(row).filter(([key, value]) => value !== undefined && hasColumn(table, key));
  const columns = entries.map(([key]) => key);
  const values = entries.map(([, value]) => value);
  const placeholders = columns.map(() => "?").join(", ");
  getDb().prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`).run(...values);
}

export function updateRow(table: string, rowId: string, patch: Record<string, unknown>) {
  const entries = Object.entries(patch).filter(([key, value]) => value !== undefined && hasColumn(table, key));
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  getDb().prepare(`UPDATE ${table} SET ${assignments} WHERE id = ?`).run(...entries.map(([, value]) => value), rowId);
}

export function requireCompanyId(request: FastifyRequest): string {
  const value = (request.body as { company_id?: string } | undefined)?.company_id ?? firstCompanyId();
  if (!value) throw new AppError("SETUP_REQUIRED", "Create a local company first", 400);
  return value;
}
