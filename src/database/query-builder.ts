import type { AxiosInstance } from "axios";
import type { Routes } from "../core/routes";
import { safe, type Result } from "../core/result";
import type { Filters, Row } from "../core/types";
import { buildRequest } from "./requests";
import type { Operation, QueryState } from "./types";

/**
 * Chainable, awaitable query. Every call returns `this`.
 *   await corebase.update({ name: "x" }).from("categories").where({ id })
 */
export class QueryBuilder<T = any> implements PromiseLike<Result<T>> {
  private state: QueryState = { columns: "*", filters: {}, single: false };

  constructor(private readonly http: AxiosInstance, private readonly routes: Routes) {}

  /* ---- target ---- */
  from(table: string) { this.state.table = table; return this; }

  /* ---- operations ---- */
  select(columns: string | string[] = "*") {
    this.state.columns = Array.isArray(columns) ? columns.join(",") : columns;
    return this.use("select");
  }
  get(columns?: string | string[]) { return this.select(columns); }
  insert(row: Row) { return this.use("insert", row); }
  insertMany(rows: Row[]) { return this.use("insertMany", rows); }
  update(values: Row) { return this.use("update", values); }
  /** Each row must include its `id`. */
  updateMany(rows: Row[]) { return this.use("updateMany", rows); }
  delete() { return this.use("delete"); }
  deleteMany(ids: string[]) { return this.use("deleteMany", ids); }

  /* ---- modifiers ---- */
  where(filters: Filters) { Object.assign(this.state.filters, filters); return this; }
  eq(column: string, value: unknown) { return this.where({ [column]: value }); }
  limit(n: number) { this.state.limit = n; return this; }
  offset(n: number) { this.state.offset = n; return this; }
  orderBy(column: string, opts: { ascending?: boolean } = {}) {
    this.state.order = { column, ascending: opts.ascending ?? true };
    return this;
  }
  /** Return the first row instead of an array. */
  single() { this.state.single = true; return this; }

  /* ---- execution ---- */
  execute(): Promise<Result<T>> {
    return safe(async () => {
      const config = buildRequest(this.state, this.routes);
      const { data } = await this.http.request(config);
      return (this.state.single && Array.isArray(data) ? data[0] ?? null : data) as T;
    });
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
