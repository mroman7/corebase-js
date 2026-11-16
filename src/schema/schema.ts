import type { AxiosInstance } from "axios";
import { safe, type Result } from "../core/result";
import type { Routes } from "../core/routes";

export interface SchemaForeignKey {
    targetTable: string;
    targetColumn: string;
    onUpdate: string;
    onDelete: string;
}

export interface SchemaColumn {
    name: string;
    /** Normalised type: TEXT, VARCHAR, INTEGER, BOOLEAN, TIMESTAMPTZ, UUID, JSONB, ENUM ... */
    type: string;
    /** e.g. "VARCHAR(255)", "NUMERIC(10,2)" */
    rawType: string;
    isArray: boolean;
    maxLength: number | null;
    precision: number | null;
    scale: number | null;
    dimension: number | null;
    isNullable: boolean;
    defaultValue: string | null;
    isPrimaryKey: boolean;
    isUnique: boolean;
    foreignKey: SchemaForeignKey | null;
    /** Sirf ENUM columns ke liye */
    enumValues: string[] | null;
    position: number;
}

export interface SchemaTable {
    tableName: string;
    columns: SchemaColumn[];
}

/** READ-ONLY schema metadata: corebase.schema.*  (backend par logged-in session chahiye) */
export class CorebaseSchema {
    constructor(private readonly http: AxiosInstance, private readonly routes: Routes) { }

    /** Ek table ke columns: type, nullable, default, foreign key, enum values. Login chahiye. */
    getTable(table: string): Promise<Result<SchemaTable>> {
        return safe(
            async () =>
                (await this.http.request<{ data: SchemaTable }>({ method: "GET", url: this.routes.schema.table(table) })).data.data,
        );
    }
}