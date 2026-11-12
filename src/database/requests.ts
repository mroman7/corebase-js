import type { AxiosRequestConfig } from "axios";
import { CorebaseError } from "../core/errors";
import type { Routes } from "../core/routes";
import type { Operation, QueryState } from "./types";

const requireTable = (s: QueryState): string => {
  if (!s.table) throw new CorebaseError("No table set. Call .from('table_name').");
  return s.table;
};

/** update/delete work by id: .eq('id', value) */
const requireId = (s: QueryState): string => {
  const f = s.filters.find(([col, op]) => col === "id" && op === "eq");
  if (!f || f[2] === undefined || f[2] === null) {
    throw new CorebaseError(`${s.operation}() needs .eq('id', value). Use ${s.operation}Many for bulk.`);
  }
  return String(f[2]);
};

/** Backend expects: select, filters (JSON array of [col, op, value]), limit, offset, order ("col.asc"). */
const selectParams = (s: QueryState) => ({
  select: s.columns,
  ...(s.filters.length > 0 && { filters: JSON.stringify(s.filters) }),
  ...((s.single !== "none" && s.limit === undefined) ? { limit: 1 } : {}),
  ...(s.limit !== undefined && { limit: s.limit }),
  ...(s.offset !== undefined && { offset: s.offset }),
  ...(s.order && { order: `${s.order.column}.${s.order.ascending ? "asc" : "desc"}` }),
});

type Builder = (s: QueryState, r: Routes) => AxiosRequestConfig;

const builders: Record<Operation, Builder> = {
  select: (s, r) => ({ method: "GET", url: r.rows.list(requireTable(s)), params: selectParams(s) }),
  insert: (s, r) => ({ method: "POST", url: r.rows.insert(requireTable(s)), data: s.payload }),
  insertMany: (s, r) => ({ method: "POST", url: r.rows.insertMany(requireTable(s)), data: s.payload }),
  update: (s, r) => ({ method: "PUT", url: r.rows.update(requireTable(s), requireId(s)), data: s.payload }),
  updateMany: (s, r) => ({ method: "PUT", url: r.rows.updateMany(requireTable(s)), data: { data: s.payload } }),
  delete: (s, r) => ({ method: "DELETE", url: r.rows.delete(requireTable(s), requireId(s)) }),
  deleteMany: (s, r) => ({ method: "DELETE", url: r.rows.deleteMany(requireTable(s)), data: { ids: s.payload } }),
};

export function buildRequest(state: QueryState, routes: Routes): AxiosRequestConfig {
  if (!state.operation) {
    throw new CorebaseError("No operation set. Call select(), insert(), update(), delete()...");
  }
  return builders[state.operation](state, routes);
}