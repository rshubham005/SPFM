// HTTP client for the SPFM ASP.NET Core API.
// Every request carries the signed-in user's Microsoft Entra access token.
// Endpoints and payloads are described in docs/API-CONTRACT.md.

import { config } from "./config";

type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider = async () => null;

/** Called by the AuthProvider once sign-in is ready. */
export function setTokenProvider(fn: TokenProvider) {
  tokenProvider = fn;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenProvider();
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the SPFM API. Check that it's running and the address is correct.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.title || body?.message || "";
    } catch {
      /* not JSON */
    }
    const reason =
      res.status === 401
        ? "Your sign-in has expired. Sign in again."
        : res.status === 403
          ? "Your account doesn't have access to SPFM."
          : res.status === 404
            ? "Not found."
            : detail || `The API returned an error (${res.status}).`;
    throw new ApiError(res.status, reason);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface Me {
  name: string;
  email?: string;
}

/** The existing protected endpoint, used to confirm sign-in reaches the API. */
export const getMe = () => apiFetch<Me>("/api/users/me");
