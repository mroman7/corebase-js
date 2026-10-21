import type { AxiosRequestConfig } from "axios";
import { CorebaseError } from "../core/errors";
import type { Routes } from "../core/routes";
import type { Operation, QueryState } from "./types";

const requireTable = (s: QueryState): string => {
  if (!s.table) throw new CorebaseError("No table set. Call .from('table_name').");
  return s.table;
};

const requireId = (s: QueryState): string => {
  const id = s.filters.id;
  if (id === undefined || id === null) {
    throw new CorebaseError(`${s.operation}() needs .where({ id: "..." }). Use ${s.operation}Many for bulk.`);
  }
  return String(id);
};

/** Query-string for GET rows. Adjust here if the backend expects a different filter format. */
const selectParams = (s: QueryState) => ({
  select: s.columns,
  ...s.filters,
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
