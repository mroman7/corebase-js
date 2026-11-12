const seg = encodeURIComponent;

/**
 * Every backend path lives here. Only routes that exist on the PUBLIC backend.
 * (Schema management / RLS policies are dashboard-only and intentionally not here.)
 */
export function createRoutes(projectId: string) {
  const project = `/project/${seg(projectId)}`;
  const table = (name: string) => `${project}/table/${seg(name)}`;

  return {
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