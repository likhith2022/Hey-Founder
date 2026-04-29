export type ApiResult<T> = { data: T };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ message: res.statusText }))) as { message?: string; [key: string]: unknown };
    throw Object.assign(new Error(err.message ?? "Request failed"), err);
  }
  return (await res.json()) as T;
}

export const list = async <T>(resource: string) => (await api<ApiResult<T[]>>(`/api/${resource}`)).data;
export const create = async <T>(resource: string, body: unknown) => (await api<ApiResult<T>>(`/api/${resource}`, { method: "POST", body: JSON.stringify(body) })).data;
export const patch = async <T>(resource: string, id: string, body: unknown) => (await api<ApiResult<T>>(`/api/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(body) })).data;
export const remove = async (resource: string, id: string) => (await api<ApiResult<void>>(`/api/${resource}/${id}`, { method: "DELETE" })).data;
