import type { Filters } from "../core/types";

export type Operation =
  | "select"
  | "insert"
  | "insertMany"
  | "update"
  | "updateMany"
  | "delete"
  | "deleteMany";

export interface QueryState {
  table?: string;
  operation?: Operation;
  payload?: unknown;
  columns: string;
  filters: Filters;
  limit?: number;
  offset?: number;
  order?: { column: string; ascending: boolean };
  single: boolean;
}

/* ---- schema (table management) types ---- */

export type ColumnType =
  | "VARCHAR" | "TEXT" | "UUID" | "BOOLEAN" | "JSONB" | "VECTOR"
  | "INTEGER" | "BIGINT" | "NUMERIC" | "TIMESTAMP" | "DATE"
  | (string & {}); // allow any other type the backend supports

export interface ForeignKey {
  targetTable: string;
  targetColumn: string;
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  length?: number;
  dimension?: number; // VECTOR
  isNullable?: boolean;
  isUnique?: boolean;
  isArray?: boolean;
  defaultValue?: string;
  foreignKey?: ForeignKey;
}

export interface CreateTableInput {
  tableName: string;
  columns: ColumnDefinition[];
}

export interface AlterTableInput {
  newTableName?: string;
  addColumns?: ColumnDefinition[];
  alterColumns?: Array<Partial<ColumnDefinition> & { name: string }>;
  dropColumns?: string[];
}
