export interface ApiError {
  success: false;
  error: string;
}

export interface ApiSuccess<T = undefined> {
  success: true;
  data: T;
}

export type ApiResponse<T = undefined> = ApiSuccess<T> | ApiError;

export async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Fetch error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
