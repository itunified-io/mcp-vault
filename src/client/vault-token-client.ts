/**
 * Vault client using static token authentication.
 */

import axios, { type AxiosInstance } from "axios";
import https from "https";
import type { IVaultClient, VaultClientConfig } from "./types.js";
import { extractError } from "../utils/errors.js";

export class VaultTokenClient implements IVaultClient {
  readonly addr: string;
  private readonly http: AxiosInstance;

  constructor(config: VaultClientConfig) {
    this.addr = config.addr;

    const headers: Record<string, string> = {
      "X-Vault-Token": config.token,
      "Content-Type": "application/json",
    };
    if (config.namespace) {
      headers["X-Vault-Namespace"] = config.namespace;
    }

    this.http = axios.create({
      baseURL: `${config.addr}/v1`,
      timeout: config.timeout ?? 30000,
      headers,
      ...(config.tlsSkipVerify
        ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
        : {}),
    });
  }

  async get<T>(path: string): Promise<T> {
    try {
      const response = await this.http.get<T>(path);
      return response.data;
    } catch (error) {
      throw extractError(error, `GET ${path}`);
    }
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    try {
      const response = await this.http.post<T>(path, data);
      return response.data;
    } catch (error) {
      throw extractError(error, `POST ${path}`);
    }
  }

  async put<T>(path: string, data?: unknown): Promise<T> {
    try {
      const response = await this.http.put<T>(path, data);
      return response.data;
    } catch (error) {
      throw extractError(error, `PUT ${path}`);
    }
  }

  async delete<T>(path: string): Promise<T> {
    try {
      const response = await this.http.delete<T>(path);
      return response.data;
    } catch (error) {
      throw extractError(error, `DELETE ${path}`);
    }
  }

  async deleteVoid(path: string): Promise<void> {
    try {
      await this.http.delete(path);
    } catch (error) {
      throw extractError(error, `DELETE ${path}`);
    }
  }

  async list<T>(path: string): Promise<T> {
    try {
      const response = await this.http.request<T>({
        method: "LIST",
        url: path,
      });
      return response.data;
    } catch (error) {
      // Vault returns 404 for empty lists — normalize to empty keys
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { request_id: "", data: { keys: [] } } as T;
      }
      throw extractError(error, `LIST ${path}`);
    }
  }
}
