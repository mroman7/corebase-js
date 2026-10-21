import type { AxiosInstance } from "axios";
import { send } from "../core/http";
import type { Routes } from "../core/routes";
import type { AlterTableInput, CreateTableInput } from "./types";

/** Schema management: corebase.tables.* */
export class CorebaseTables {
  constructor(private readonly http: AxiosInstance, private readonly routes: Routes) {}

  list() {
    return send(this.http, { method: "GET", url: this.routes.tables.list });
  }
  metadata(table: string) {
    return send(this.http, { method: "GET", url: this.routes.tables.metadata(table) });
  }
  create(input: CreateTableInput) {
    return send(this.http, { method: "POST", url: this.routes.tables.create, data: input });
  }
  alter(table: string, changes: AlterTableInput) {
    return send(this.http, { method: "PATCH", url: this.routes.tables.alter(table), data: changes });
  }
  drop(table: string) {
    return send(this.http, { method: "DELETE", url: this.routes.tables.drop(table) });
  }
}
