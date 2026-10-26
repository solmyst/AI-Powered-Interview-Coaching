export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    signal: options.signal || AbortSignal.timeout(250000),
  });
  const data = await response.json().catch(() => ({
    error: "The server could not respond. Check the connection and retry.",
  }));
  if (!response.ok)
    throw new Error(data.error || "Request failed. Please retry.");
  return data as T;
}
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
