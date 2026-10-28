export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    signal: options.signal || AbortSignal.timeout(250000),
  }); } catch (reason) {
    throw new Error(reason instanceof DOMException && ["TimeoutError", "AbortError"].includes(reason.name)
      ? "This is taking longer than expected. Check your connection and retry."
      : "We couldn’t reach InterviewAce. Check your connection and retry.");
  }
  const data = await response.json().catch(() => null);
  if (data === null) throw new Error("The server returned an unreadable response. Please retry.");
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("interviewace:session-expired"));
      throw new Error("Your session has expired. Sign in again to reopen your saved interviews.");
    }
    throw new Error(data.error || "Request failed. Please retry.");
  }
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
