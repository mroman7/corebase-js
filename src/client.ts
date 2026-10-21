import { CorebaseAuth } from "./auth/auth";
import { resolveConfig, type CorebaseConfig } from "./core/config";
import { tokenStorageKey } from "./core/constants";
import { createHttp } from "./core/http";
import { createRoutes } from "./core/routes";
import { TokenStore } from "./core/token-store";
import type { Row } from "./core/types";
import { QueryBuilder } from "./database/query-builder";
import { CorebaseTables } from "./database/tables";
import { CorebaseStorage } from "./storage/storage";

export class CorebaseClient {
  readonly auth: CorebaseAuth;
  readonly storage: CorebaseStorage;
  readonly tables: CorebaseTables;

  private readonly http;
  private readonly routes;

  constructor(options: CorebaseConfig) {
    const config = resolveConfig(options);
    const tokens = new TokenStore(config.storage, tokenStorageKey(config.projectId));

    this.http = createHttp(config, tokens);
    this.routes = createRoutes(config.projectId);

    this.auth = new CorebaseAuth(config, tokens);
    this.storage = new CorebaseStorage(this.http, this.routes, config);
    this.tables = new CorebaseTables(this.http, this.routes);
  }

  /* Every entry point starts a fresh QueryBuilder. */
  from<T = any>(table: string) { return this.query<T>().from(table); }
  select<T = any>(columns?: string | string[]) { return this.query<T>().select(columns); }
  get<T = any>(columns?: string | string[]) { return this.query<T>().get(columns); }
  insert<T = any>(row: Row) { return this.query<T>().insert(row); }
  insertMany<T = any>(rows: Row[]) { return this.query<T>().insertMany(rows); }
  update<T = any>(values: Row) { return this.query<T>().update(values); }
  updateMany<T = any>(rows: Row[]) { return this.query<T>().updateMany(rows); }
  delete<T = any>() { return this.query<T>().delete(); }
  deleteMany<T = any>(ids: string[]) { return this.query<T>().deleteMany(ids); }

  private query<T>() {
    return new QueryBuilder<T>(this.http, this.routes);
  }
}

export const createClient = (options: CorebaseConfig) => new CorebaseClient(options);
