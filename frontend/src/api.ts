const API_URL = "http://127.0.0.1:8000/api";

export async function api<T = unknown>(path: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(API_URL + path, {
    method,
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  }).catch(() => {
    throw new Error("Could not connect to the server. Please try again.");
  });

  const result = await response.json().catch(() => {
    if (response.ok) throw new Error("Unexpected server response. Please try again.");
    return null;
  });
  if (!response.ok) {
    throw new Error(typeof result?.detail === "string" ? result.detail : "Request failed. Please try again.");
  }
  return result;
}
