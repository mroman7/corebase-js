# corebase-js

JS/TS client for Corebase. Works on web and React Native.

```bash
bun install corebase-js@github:mroman7/corebase-js#release
```

```ts
import { createClient } from "corebase-js";

export const corebase = createClient({
  url: "https://api.yourapp.com",
  projectId: "PROJECT_ID",
  apiKey: "PROJECT_SECRET",
  // React Native: storage: AsyncStorage, origin: "https://yourapp.com"
});
```

## Database
Every call resolves to `{ data, error }` and never throws.

```ts
await corebase.select("id, title").from("categories").where({ slug: "retail" }).limit(10);
await corebase.from("categories").select().orderBy("id", { ascending: false });
await corebase.insert({ title: "Retail" }).from("categories");
await corebase.insertMany([{ title: "A" }, { title: "B" }]).from("categories");
await corebase.update({ title: "New" }).from("categories").where({ id });
await corebase.updateMany([{ id, title: "New" }]).from("categories");
await corebase.delete().from("categories").where({ id });
await corebase.deleteMany([id1, id2]).from("categories");
```

## Auth
```ts
await corebase.auth.signUp({ name, email, password });
await corebase.auth.signIn({ email, password });
await corebase.auth.getSession();
await corebase.auth.signOut();
corebase.auth.client; // raw better-auth client (plugins etc.)
```

## Storage
```ts
const { data } = await corebase.storage.upload(file);
corebase.storage.getUrl(fileId);
await corebase.storage.download(fileId);
await corebase.storage.remove(fileId);
```

## Tables (schema)
```ts
await corebase.tables.list();
await corebase.tables.create({ tableName: "posts", columns: [{ name: "title", type: "TEXT" }] });
await corebase.tables.alter("posts", { dropColumns: ["old"] });
await corebase.tables.drop("posts");
```

## Publish
```bash
npm login && npm publish
```
