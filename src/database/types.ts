export type Operation =
  | "select"
  | "insert"
  | "insertMany"
  | "update"
  | "updateMany"
  | "delete"
  | "deleteMany";

/** Filter operators supported by the backend (`filters` query param). */
export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "is";
export type FilterTuple = [column: string, op: FilterOp, value: unknown];

export interface QueryState {
  table?: string;
  operation?: Operation;
  payload?: unknown;
  columns: string;
  filters: FilterTuple[];
  limit?: number;
  offset?: number;
  order?: { column: string; ascending: boolean };
  single: "none" | "single" | "maybe";
}