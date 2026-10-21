const seg = encodeURIComponent;

/** Every backend path lives here. Change an endpoint once, it changes everywhere. */
export function createRoutes(projectId: string) {
  const project = `/project/${seg(projectId)}`;
  const table = (name: string) => `${project}/table/${seg(name)}`;

  return {
    tables: {
      list: `${project}/tables`,
      create: `${project}/table/create`,
      metadata: (t: string) => `${table(t)}/metadata`,
      alter: (t: string) => `${table(t)}/alter`,
      drop: (t: string) => `${table(t)}/drop`,
    },
    rows: {
      list: (t: string) => `${table(t)}/rows`,
      insert: (t: string) => `${table(t)}/insert`,
      insertMany: (t: string) => `${table(t)}/insert-many`,
      update: (t: string, id: string) => `${table(t)}/update/${seg(id)}`,
      updateMany: (t: string) => `${table(t)}/update-many`,
      delete: (t: string, id: string) => `${table(t)}/delete/${seg(id)}`,
      deleteMany: (t: string) => `${table(t)}/delete-many`,
    },
    storage: {
      upload: "/f/upload",
      file: (fileId: string) => `/f/${seg(fileId)}`,
    },
  } as const;
}

export type Routes = ReturnType<typeof createRoutes>;
