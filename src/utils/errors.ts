/**
 * Vault API error handling.
 */

import axios from "axios";

export class VaultApiError extends Error {
  readonly status: number | undefined;
  readonly endpoint: string;
  readonly details: string | undefined;

  constructor(
    message: string,
    endpoint: string,
    status?: number,
    details?: string,
  ) {
    super(message);
    this.name = "VaultApiError";
    this.endpoint = endpoint;
    this.status = status;
    this.details = details;
  }
}

export function extractError(
  error: unknown,
  endpoint: string,
): VaultApiError {
  if (error instanceof VaultApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const response = error.response;
    if (response) {
      const data = response.data as { errors?: string[] } | undefined;
      const message =
        data?.errors && data.errors.length > 0
          ? data.errors.join("; ")
          : `Vault API error: ${response.status} ${response.statusText}`;
      return new VaultApiError(message, endpoint, response.status);
    }

    if (
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT"
    ) {
      return new VaultApiError(
        `Network error: ${error.code} — unable to reach Vault at ${endpoint}`,
        endpoint,
      );
    }

    return new VaultApiError(
      error.message || "Unknown network error",
      endpoint,
    );
  }

  if (error instanceof Error) {
    return new VaultApiError(error.message, endpoint);
  }

  return new VaultApiError("Unknown error occurred", endpoint);
}
