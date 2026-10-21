import { createAuthClient } from 'better-auth/client';
import { AxiosInstance } from 'axios';

interface StorageAdapter {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem(key: string): void | Promise<void>;
}
type Row = Record<string, any>;
type Filters = Record<string, any>;

interface CorebaseConfig {
    /** Backend base URL, e.g. https://api.corebase.dev */
    url: string;
    /** Project this client is bound to. */
    projectId: string;
    /** Project secret / API key (sent as the `apikey` header). */
    apiKey: string;
    /** Where the auth token is persisted. Defaults to localStorage, then memory. Pass AsyncStorage on React Native. */
    storage?: StorageAdapter;
    /** Sent as the `Origin` header — needed on React Native, where no Origin exists. */
    origin?: string;
    /** Request timeout in ms. */
    timeout?: number;
}
type ResolvedConfig = Omit<CorebaseConfig, "timeout"> & {
    timeout: number;
};

declare class CorebaseError extends Error {
    readonly status?: number | undefined;
    readonly details?: unknown | undefined;
    constructor(message: string, status?: number | undefined, details?: unknown | undefined);
}

/** Every public async method resolves to this — it never throws. */
type Result<T> = {
    data: T;
    error: null;
} | {
    data: null;
    error: CorebaseError;
};

/**
 * Holds the auth token. Reads are sync (in-memory cache),
 * persistence is async so it works with AsyncStorage on React Native.
 */
declare class TokenStore {
    private readonly key;
    private token;
    /** Resolves once the persisted token has been loaded. */
    readonly ready: Promise<void>;
    private readonly storage;
    constructor(storage: StorageAdapter | undefined, key: string);
    private hydrate;
    get(): string | null;
    set(token: string): Promise<void>;
    clear(): Promise<void>;
}

interface SignUpInput {
    name: string;
    email: string;
    password: string;
}
interface SignInInput {
    email: string;
    password: string;
}
/** Authentication: corebase.auth.*  (powered by better-auth, scoped to this project) */
declare class CorebaseAuth {
    private readonly tokens;
    /** Raw better-auth client — escape hatch for plugins and advanced calls. */
    readonly client: ReturnType<typeof createAuthClient>;
    constructor(config: ResolvedConfig, tokens: TokenStore);
    signUp(input: SignUpInput): Promise<Result<unknown>>;
    signIn(input: SignInInput): Promise<Result<unknown>>;
    signOut(): Promise<Result<unknown>>;
    getSession(): Promise<Result<unknown>>;
    /** Current token (sync). Null when signed out. */
    getToken(): string | null;
    /** Normalises better-auth responses into our Result shape and persists tokens. */
    private call;
}

/** Every backend path lives here. Change an endpoint once, it changes everywhere. */
declare function createRoutes(projectId: string): {
    readonly tables: {
        readonly list: `${string}/tables`;
        readonly create: `${string}/table/create`;
        readonly metadata: (t: string) => string;
        readonly alter: (t: string) => string;
        readonly drop: (t: string) => string;
    };
    readonly rows: {
        readonly list: (t: string) => string;
        readonly insert: (t: string) => string;
        readonly insertMany: (t: string) => string;
        readonly update: (t: string, id: string) => string;
        readonly updateMany: (t: string) => string;
        readonly delete: (t: string, id: string) => string;
        readonly deleteMany: (t: string) => string;
    };
    readonly storage: {
        readonly upload: "/f/upload";
        readonly file: (fileId: string) => string;
    };
};
type Routes = ReturnType<typeof createRoutes>;

/**
 * Chainable, awaitable query. Every call returns `this`.
 *   await corebase.update({ name: "x" }).from("categories").where({ id })
 */
declare class QueryBuilder<T = any> implements PromiseLike<Result<T>> {
    private readonly http;
    private readonly routes;
    private state;
    constructor(http: AxiosInstance, routes: Routes);
    from(table: string): this;
    select(columns?: string | string[]): this;
    get(columns?: string | string[]): this;
    insert(row: Row): this;
    insertMany(rows: Row[]): this;
    update(values: Row): this;
    /** Each row must include its `id`. */
    updateMany(rows: Row[]): this;
    delete(): this;
    deleteMany(ids: string[]): this;
    where(filters: Filters): this;
    eq(column: string, value: unknown): this;
    limit(n: number): this;
    offset(n: number): this;
    orderBy(column: string, opts?: {
        ascending?: boolean;
    }): this;
    /** Return the first row instead of an array. */
    single(): this;
    execute(): Promise<Result<T>>;
    then<R1 = Result<T>, R2 = never>(onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null, onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2>;
    private use;
}

type Operation = "select" | "insert" | "insertMany" | "update" | "updateMany" | "delete" | "deleteMany";
interface QueryState {
    table?: string;
    operation?: Operation;
    payload?: unknown;
    columns: string;
    filters: Filters;
    limit?: number;
    offset?: number;
    order?: {
        column: string;
        ascending: boolean;
    };
    single: boolean;
}
type ColumnType = "VARCHAR" | "TEXT" | "UUID" | "BOOLEAN" | "JSONB" | "VECTOR" | "INTEGER" | "BIGINT" | "NUMERIC" | "TIMESTAMP" | "DATE" | (string & {});
interface ForeignKey {
    targetTable: string;
    targetColumn: string;
    onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
    onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}
interface ColumnDefinition {
    name: string;
    type: ColumnType;
    length?: number;
    dimension?: number;
    isNullable?: boolean;
    isUnique?: boolean;
    isArray?: boolean;
    defaultValue?: string;
    foreignKey?: ForeignKey;
}
interface CreateTableInput {
    tableName: string;
    columns: ColumnDefinition[];
}
interface AlterTableInput {
    newTableName?: string;
    addColumns?: ColumnDefinition[];
    alterColumns?: Array<Partial<ColumnDefinition> & {
        name: string;
    }>;
    dropColumns?: string[];
}

/** Schema management: corebase.tables.* */
declare class CorebaseTables {
    private readonly http;
    private readonly routes;
    constructor(http: AxiosInstance, routes: Routes);
    list(): Promise<Result<unknown>>;
    metadata(table: string): Promise<Result<unknown>>;
    create(input: CreateTableInput): Promise<Result<unknown>>;
    alter(table: string, changes: AlterTableInput): Promise<Result<unknown>>;
    drop(table: string): Promise<Result<unknown>>;
}

/** Browser File/Blob, or the `{ uri, name, type }` object React Native uses. */
type UploadableFile = Blob | {
    uri: string;
    name: string;
    type: string;
};
/** File handling: corebase.storage.* */
declare class CorebaseStorage {
    private readonly http;
    private readonly routes;
    private readonly config;
    constructor(http: AxiosInstance, routes: Routes, config: ResolvedConfig);
    upload(file: UploadableFile): Promise<Result<unknown>>;
    /** Public URL — use directly in <img src> / <Image source>. No request is made. */
    getUrl(fileId: string): string;
    /** Downloads the file as a Blob. */
    download(fileId: string): Promise<Result<Blob>>;
    remove(fileId: string): Promise<Result<unknown>>;
}

declare class CorebaseClient {
    readonly auth: CorebaseAuth;
    readonly storage: CorebaseStorage;
    readonly tables: CorebaseTables;
    private readonly http;
    private readonly routes;
    constructor(options: CorebaseConfig);
    from<T = any>(table: string): QueryBuilder<T>;
    select<T = any>(columns?: string | string[]): QueryBuilder<T>;
    get<T = any>(columns?: string | string[]): QueryBuilder<T>;
    insert<T = any>(row: Row): QueryBuilder<T>;
    insertMany<T = any>(rows: Row[]): QueryBuilder<T>;
    update<T = any>(values: Row): QueryBuilder<T>;
    updateMany<T = any>(rows: Row[]): QueryBuilder<T>;
    delete<T = any>(): QueryBuilder<T>;
    deleteMany<T = any>(ids: string[]): QueryBuilder<T>;
    private query;
}
declare const createClient: (options: CorebaseConfig) => CorebaseClient;

export { CorebaseClient, CorebaseError, QueryBuilder, createClient };
export type { AlterTableInput, ColumnDefinition, ColumnType, CorebaseConfig, CreateTableInput, Filters, ForeignKey, Operation, QueryState, Result, Row, SignInInput, SignUpInput, StorageAdapter, UploadableFile };
