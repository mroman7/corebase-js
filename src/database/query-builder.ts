import type { AxiosInstance } from "axios";
import { CorebaseError, toCorebaseError } from "../core/errors";
import type { Result } from "../core/result";
import type { Routes } from "../core/routes";
import type { Filters, Row } from "../core/types";
import { buildRequest } from "./requests";
import type { FilterOp, Operation, QueryState } from "./types";

/**
 * Chainable, awaitable query (Supabase style). Resolves to { data, error, count }.
 *
 *   await corebase.from("units").select("name,symbol").eq("is_active", true).order("name").limit(20)
 *   await corebase.from("units").insert({ name: "Kg" })
 *   await corebase.from("units").update({ name: "KG" }).eq("id", id)
 *   await corebase.from("units").delete().eq("id", id)
 *   await corebase.from("units").select().eq("id", id).single()
 */
export class QueryBuilder<T = any> implements PromiseLike<Result<T>> {
  private state: QueryState = { columns: "*", filters: [], single: "none" };

  constructor(private readonly http: AxiosInstance, private readonly routes: Routes) {}

  /* ---- target ---- */
  from(table: string) { this.state.table = table; return this; }

  /* ---- operations ---- */
  /** After insert()/update(), select() just keeps the operation (rows are always returned). */
  select(columns: string | string[] = "*") {
    this.state.columns = Array.isArray(columns) ? columns.join(",") : columns;
    if (!this.state.operation) this.state.operation = "select";
    return this;
  }
  get(columns?: string | string[]) { return this.select(columns); }
  insert(row: Row) { return this.use("insert", row); }
  insertMany(rows: Row[]) { return this.use("insertMany", rows); }
  /** Needs .eq('id', value). */
  update(values: Row) { return this.use("update", values); }
  /** Each row must include its `id`. */
  updateMany(rows: Row[]) { return this.use("updateMany", rows); }
  /** Needs .eq('id', value). */
  delete() { return this.use("delete"); }
  deleteMany(ids: string[]) { return this.use("deleteMany", ids); }

  /* ---- filters ---- */
  private filter(column: string, op: FilterOp, value: unknown) {
    this.state.filters.push([column, op, value]);
    return this;
  }
  /** Object form: .where({ id, status }) => every key is an `eq` filter. */
  where(filters: Filters) {
    for (const [k, v] of Object.entries(filters)) this.filter(k, "eq", v);
    return this;
  }
  eq(column: string, value: unknown) { return this.filter(column, "eq", value); }
  neq(column: string, value: unknown) { return this.filter(column, "neq", value); }
  gt(column: string, value: unknown) { return this.filter(column, "gt", value); }
  gte(column: string, value: unknown) { return this.filter(column, "gte", value); }
  lt(column: string, value: unknown) { return this.filter(column, "lt", value); }
  lte(column: string, value: unknown) { return this.filter(column, "lte", value); }
  like(column: string, pattern: string) { return this.filter(column, "like", pattern); }
  ilike(column: string, pattern: string) { return this.filter(column, "ilike", pattern); }
  in(column: string, values: unknown[]) { return this.filter(column, "in", values); }
  is(column: string, value: null | boolean) { return this.filter(column, "is", value); }

  /* ---- modifiers ---- */
  limit(n: number) { this.state.limit = n; return this; }
  offset(n: number) { this.state.offset = n; return this; }
  /** Inclusive range, like Supabase: range(0, 9) => first 10 rows. */
  range(from: number, to: number) {
    this.state.offset = from;
    this.state.limit = to - from + 1;
    return this;
  }
  order(column: string, opts: { ascending?: boolean } = {}) {
    this.state.order = { column, ascending: opts.ascending ?? true };
    return this;
  }
  /** Alias of order(). */
  orderBy(column: string, opts: { ascending?: boolean } = {}) { return this.order(column, opts); }
  /** Exactly one row, error if none. */
  single() { this.state.single = "single"; return this; }
  /** One row or null. */
  maybeSingle() { this.state.single = "maybe"; return this; }

  /* ---- execution ---- */
  async execute(): Promise<Result<T>> {
    try {
      const config = buildRequest(this.state, this.routes);
      const { data: body } = await this.http.request(config);

      // Backend shape: { success, data, count?, total? }
      const payload = body && typeof body === "object" && "data" in body ? body.data : body;
      const count =
        typeof body?.total === "number" ? body.total : typeof body?.count === "number" ? body.count : null;

      if (this.state.single !== "none") {
        const row = Array.isArray(payload) ? payload[0] : payload;
        if (row === undefined || row === null) {
          if (this.state.single === "single") throw new CorebaseError("No rows found", 404);
          return { data: null as T, error: null, count };
        }
        return { data: row as T, error: null, count };
      }

      return { data: payload as T, error: null, count };
    } catch (err) {
      return { data: null, error: toCorebaseError(err), count: null };
    }
  }

  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private use(operation: Operation, payload?: unknown) {
    this.state.operation = operation;
    this.state.payload = payload;
    return this;
  }
}