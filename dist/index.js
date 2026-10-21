// src/auth/auth.ts
import { createAuthClient } from "better-auth/client";

// src/core/constants.ts
var HEADERS = {
  apiKey: "apikey",
  authorization: "Authorization",
  origin: "Origin"
};
var AUTH_SCHEME = "Bearer";
var TOKEN_RESPONSE_HEADER = "set-auth-token";
var DEFAULT_TIMEOUT_MS = 3e4;
var tokenStorageKey = (projectId) => `corebase.${projectId}.token`;

// src/core/errors.ts
import axios from "axios";
var CorebaseError = class extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "CorebaseError";
  }
};
function toCorebaseError(err) {
  var _a, _b, _c, _d;
  if (err instanceof CorebaseError) return err;
  if (axios.isAxiosError(err)) {
    const body = (_a = err.response) == null ? void 0 : _a.data;
    return new CorebaseError(
      (_c = (_b = body == null ? void 0 : body.message) != null ? _b : body == null ? void 0 : body.error) != null ? _c : err.message,
      (_d = err.response) == null ? void 0 : _d.status,
      body
    );
  }
  return new CorebaseError(err instanceof Error ? err.message : String(err));
}

// src/auth/auth.ts
var CorebaseAuth = class {
  constructor(config, tokens) {
    this.tokens = tokens;
    this.client = createAuthClient({
      baseURL: `${config.url}/${config.projectId}/auth`,
      fetchOptions: {
        headers: {
          [HEADERS.apiKey]: config.apiKey,
          ...config.origin && { [HEADERS.origin]: config.origin }
        },
        auth: { type: "Bearer", token: () => {
          var _a;
          return (_a = this.tokens.get()) != null ? _a : void 0;
        } },
        onSuccess: async (ctx) => {
          const token = ctx.response.headers.get(TOKEN_RESPONSE_HEADER);
          if (token) await this.tokens.set(token);
        }
      }
    });
  }
  signUp(input) {
    return this.call(() => this.client.signUp.email(input), true);
  }
  signIn(input) {
    return this.call(() => this.client.signIn.email(input), true);
  }
  async signOut() {
    const result = await this.call(() => this.client.signOut());
    await this.tokens.clear();
    return result;
  }
  getSession() {
    return this.call(() => this.client.getSession());
  }
  /** Current token (sync). Null when signed out. */
  getToken() {
    return this.tokens.get();
  }
  /** Normalises better-auth responses into our Result shape and persists tokens. */
  async call(fn, saveToken = false) {
    var _a;
    await this.tokens.ready;
    const { data, error } = await fn();
    if (error || data === null) {
      return {
        data: null,
        error: new CorebaseError((_a = error == null ? void 0 : error.message) != null ? _a : "Auth request failed", error == null ? void 0 : error.status, error)
      };
    }
    const token = data.token;
    if (saveToken && token) await this.tokens.set(token);
    return { data, error: null };
  }
};

// src/core/config.ts
function resolveConfig(config) {
  var _a;
  const missing = ["url", "projectId", "apiKey"].filter((k) => !(config == null ? void 0 : config[k]));
  if (missing.length) {
    throw new CorebaseError(`createClient: missing required option(s): ${missing.join(", ")}`);
  }
  return {
    ...config,
    url: config.url.replace(/\/+$/, ""),
    timeout: (_a = config.timeout) != null ? _a : DEFAULT_TIMEOUT_MS
  };
}

// src/core/http.ts
import axios2 from "axios";

// src/core/result.ts
async function safe(fn) {
  try {
    return { data: await fn(), error: null };
  } catch (err) {
    return { data: null, error: toCorebaseError(err) };
  }
}

// src/core/http.ts
function createHttp(config, tokens) {
  const http = axios2.create({
    baseURL: config.url,
    timeout: config.timeout,
    headers: {
      [HEADERS.apiKey]: config.apiKey,
      ...config.origin && { [HEADERS.origin]: config.origin }
    }
  });
  http.interceptors.request.use(async (req) => {
    await tokens.ready;
    const token = tokens.get();
    if (token) req.headers.set(HEADERS.authorization, `${AUTH_SCHEME} ${token}`);
    return req;
  });
  return http;
}
var send = (http, config) => safe(async () => (await http.request(config)).data);

// src/core/routes.ts
var seg = encodeURIComponent;
function createRoutes(projectId) {
  const project = `/project/${seg(projectId)}`;
  const table = (name) => `${project}/table/${seg(name)}`;
  return {
    tables: {
      list: `${project}/tables`,
      create: `${project}/table/create`,
      metadata: (t) => `${table(t)}/metadata`,
      alter: (t) => `${table(t)}/alter`,
      drop: (t) => `${table(t)}/drop`
    },
    rows: {
      list: (t) => `${table(t)}/rows`,
      insert: (t) => `${table(t)}/insert`,
      insertMany: (t) => `${table(t)}/insert-many`,
      update: (t, id) => `${table(t)}/update/${seg(id)}`,
      updateMany: (t) => `${table(t)}/update-many`,
      delete: (t, id) => `${table(t)}/delete/${seg(id)}`,
      deleteMany: (t) => `${table(t)}/delete-many`
    },
    storage: {
      upload: "/f/upload",
      file: (fileId) => `/f/${seg(fileId)}`
    }
  };
}

// src/core/token-store.ts
var memoryStorage = () => {
  const map = /* @__PURE__ */ new Map();
  return {
    getItem: (k) => {
      var _a;
      return (_a = map.get(k)) != null ? _a : null;
    },
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  };
};
var browserStorage = () => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : void 0;
  } catch {
    return void 0;
  }
};
var TokenStore = class {
  constructor(storage, key) {
    this.key = key;
    this.token = null;
    var _a;
    this.storage = (_a = storage != null ? storage : browserStorage()) != null ? _a : memoryStorage();
    this.ready = this.hydrate();
  }
  async hydrate() {
    var _a;
    try {
      this.token = (_a = await this.storage.getItem(this.key)) != null ? _a : null;
    } catch {
      this.token = null;
    }
  }
  get() {
    return this.token;
  }
  async set(token) {
    this.token = token;
    await this.storage.setItem(this.key, token);
  }
  async clear() {
    this.token = null;
    await this.storage.removeItem(this.key);
  }
};

// src/database/requests.ts
var requireTable = (s) => {
  if (!s.table) throw new CorebaseError("No table set. Call .from('table_name').");
  return s.table;
};
var requireId = (s) => {
  const id = s.filters.id;
  if (id === void 0 || id === null) {
    throw new CorebaseError(`${s.operation}() needs .where({ id: "..." }). Use ${s.operation}Many for bulk.`);
  }
  return String(id);
};
var selectParams = (s) => ({
  select: s.columns,
  ...s.filters,
  ...s.limit !== void 0 && { limit: s.limit },
  ...s.offset !== void 0 && { offset: s.offset },
  ...s.order && { order: `${s.order.column}.${s.order.ascending ? "asc" : "desc"}` }
});
var builders = {
  select: (s, r) => ({ method: "GET", url: r.rows.list(requireTable(s)), params: selectParams(s) }),
  insert: (s, r) => ({ method: "POST", url: r.rows.insert(requireTable(s)), data: s.payload }),
  insertMany: (s, r) => ({ method: "POST", url: r.rows.insertMany(requireTable(s)), data: s.payload }),
  update: (s, r) => ({ method: "PUT", url: r.rows.update(requireTable(s), requireId(s)), data: s.payload }),
  updateMany: (s, r) => ({ method: "PUT", url: r.rows.updateMany(requireTable(s)), data: { data: s.payload } }),
  delete: (s, r) => ({ method: "DELETE", url: r.rows.delete(requireTable(s), requireId(s)) }),
  deleteMany: (s, r) => ({ method: "DELETE", url: r.rows.deleteMany(requireTable(s)), data: { ids: s.payload } })
};
function buildRequest(state, routes) {
  if (!state.operation) {
    throw new CorebaseError("No operation set. Call select(), insert(), update(), delete()...");
  }
  return builders[state.operation](state, routes);
}

// src/database/query-builder.ts
var QueryBuilder = class {
  constructor(http, routes) {
    this.http = http;
    this.routes = routes;
    this.state = { columns: "*", filters: {}, single: false };
  }
  /* ---- target ---- */
  from(table) {
    this.state.table = table;
    return this;
  }
  /* ---- operations ---- */
  select(columns = "*") {
    this.state.columns = Array.isArray(columns) ? columns.join(",") : columns;
    return this.use("select");
  }
  get(columns) {
    return this.select(columns);
  }
  insert(row) {
    return this.use("insert", row);
  }
  insertMany(rows) {
    return this.use("insertMany", rows);
  }
  update(values) {
    return this.use("update", values);
  }
  /** Each row must include its `id`. */
  updateMany(rows) {
    return this.use("updateMany", rows);
  }
  delete() {
    return this.use("delete");
  }
  deleteMany(ids) {
    return this.use("deleteMany", ids);
  }
  /* ---- modifiers ---- */
  where(filters) {
    Object.assign(this.state.filters, filters);
    return this;
  }
  eq(column, value) {
    return this.where({ [column]: value });
  }
  limit(n) {
    this.state.limit = n;
    return this;
  }
  offset(n) {
    this.state.offset = n;
    return this;
  }
  orderBy(column, opts = {}) {
    var _a;
    this.state.order = { column, ascending: (_a = opts.ascending) != null ? _a : true };
    return this;
  }
  /** Return the first row instead of an array. */
  single() {
    this.state.single = true;
    return this;
  }
  /* ---- execution ---- */
  execute() {
    return safe(async () => {
      var _a;
      const config = buildRequest(this.state, this.routes);
      const { data } = await this.http.request(config);
      return this.state.single && Array.isArray(data) ? (_a = data[0]) != null ? _a : null : data;
    });
  }
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
  use(operation, payload) {
    this.state.operation = operation;
    this.state.payload = payload;
    return this;
  }
};

// src/database/tables.ts
var CorebaseTables = class {
  constructor(http, routes) {
    this.http = http;
    this.routes = routes;
  }
  list() {
    return send(this.http, { method: "GET", url: this.routes.tables.list });
  }
  metadata(table) {
    return send(this.http, { method: "GET", url: this.routes.tables.metadata(table) });
  }
  create(input) {
    return send(this.http, { method: "POST", url: this.routes.tables.create, data: input });
  }
  alter(table, changes) {
    return send(this.http, { method: "PATCH", url: this.routes.tables.alter(table), data: changes });
  }
  drop(table) {
    return send(this.http, { method: "DELETE", url: this.routes.tables.drop(table) });
  }
};

// src/storage/storage.ts
var CorebaseStorage = class {
  constructor(http, routes, config) {
    this.http = http;
    this.routes = routes;
    this.config = config;
  }
  upload(file) {
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", this.config.projectId);
    return send(this.http, {
      method: "POST",
      url: this.routes.storage.upload,
      data: form,
      headers: { "Content-Type": "multipart/form-data" }
    });
  }
  /** Public URL — use directly in <img src> / <Image source>. No request is made. */
  getUrl(fileId) {
    return `${this.config.url}${this.routes.storage.file(fileId)}`;
  }
  /** Downloads the file as a Blob. */
  download(fileId) {
    return send(this.http, {
      method: "GET",
      url: this.routes.storage.file(fileId),
      responseType: "blob"
    });
  }
  remove(fileId) {
    return send(this.http, { method: "DELETE", url: this.routes.storage.file(fileId) });
  }
};

// src/client.ts
var CorebaseClient = class {
  constructor(options) {
    const config = resolveConfig(options);
    const tokens = new TokenStore(config.storage, tokenStorageKey(config.projectId));
    this.http = createHttp(config, tokens);
    this.routes = createRoutes(config.projectId);
    this.auth = new CorebaseAuth(config, tokens);
    this.storage = new CorebaseStorage(this.http, this.routes, config);
    this.tables = new CorebaseTables(this.http, this.routes);
  }
  /* Every entry point starts a fresh QueryBuilder. */
  from(table) {
    return this.query().from(table);
  }
  select(columns) {
    return this.query().select(columns);
  }
  get(columns) {
    return this.query().get(columns);
  }
  insert(row) {
    return this.query().insert(row);
  }
  insertMany(rows) {
    return this.query().insertMany(rows);
  }
  update(values) {
    return this.query().update(values);
  }
  updateMany(rows) {
    return this.query().updateMany(rows);
  }
  delete() {
    return this.query().delete();
  }
  deleteMany(ids) {
    return this.query().deleteMany(ids);
  }
  query() {
    return new QueryBuilder(this.http, this.routes);
  }
};
var createClient = (options) => new CorebaseClient(options);
export {
  CorebaseClient,
  CorebaseError,
  QueryBuilder,
  createClient
};
//# sourceMappingURL=index.js.map