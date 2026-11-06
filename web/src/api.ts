export async function api(path: string, options: RequestInit = {}) {
  const r = await fetch("/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (sessionStorage.getItem("token") || ""),
      ...options.headers,
    },
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "请求失败");
  return data;
}
export const send = (path: string, body: unknown, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });
