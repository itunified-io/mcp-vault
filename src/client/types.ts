/**
 * Vault API client interface and response types.
 */

export interface IVaultClient {
  readonly addr: string;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, data?: unknown): Promise<T>;
  put<T>(path: string, data?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  deleteVoid(path: string): Promise<void>;
  list<T>(path: string): Promise<T>;
}

export interface VaultClientConfig {
  addr: string;
  token: string;
  namespace?: string;
  timeout?: number;
  tlsSkipVerify?: boolean;
}

// KV v2 responses
export interface KvReadResponse {
  request_id: string;
  data: {
    data: Record<string, unknown>;
    metadata: KvMetadata;
  };
}

export interface KvMetadata {
  created_time: string;
  custom_metadata: Record<string, string> | null;
  deletion_time: string;
  destroyed: boolean;
  version: number;
}

export interface KvMetadataResponse {
  request_id: string;
  data: {
    cas_required: boolean;
    created_time: string;
    current_version: number;
    delete_version_after: string;
    max_versions: number;
    oldest_version: number;
    updated_time: string;
    custom_metadata: Record<string, string> | null;
    versions: Record<string, KvMetadata>;
  };
}

export interface KvListResponse {
  request_id: string;
  data: {
    keys: string[];
  };
}

export interface KvWriteResponse {
  request_id: string;
  data: {
    created_time: string;
    custom_metadata: Record<string, string> | null;
    deletion_time: string;
    destroyed: boolean;
    version: number;
  };
}

// Sys responses
export interface HealthResponse {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
  performance_standby: boolean;
  replication_performance_mode: string;
  replication_dr_mode: string;
  server_time_utc: number;
  version: string;
  cluster_name: string;
  cluster_id: string;
}

export interface SealStatusResponse {
  type: string;
  initialized: boolean;
  sealed: boolean;
  t: number;
  n: number;
  progress: number;
  nonce: string;
  version: string;
  build_date: string;
  migration: boolean;
  cluster_name: string;
  cluster_id: string;
  recovery_seal: boolean;
  storage_type: string;
}

export interface LeaderResponse {
  ha_enabled: boolean;
  is_self: boolean;
  active_time: string;
  leader_address: string;
  leader_cluster_address: string;
  performance_standby: boolean;
  performance_standby_last_remote_wal: number;
}

// Auth
export interface AuthMethod {
  type: string;
  description: string;
  accessor: string;
  config: Record<string, unknown>;
  options: Record<string, unknown> | null;
  local: boolean;
  seal_wrap: boolean;
}

export interface AuthLoginResponse {
  auth: {
    client_token: string;
    accessor: string;
    policies: string[];
    token_policies: string[];
    metadata: Record<string, string>;
    lease_duration: number;
    renewable: boolean;
  };
}

// Mount
export interface MountInfo {
  type: string;
  description: string;
  accessor: string;
  config: Record<string, unknown>;
  options: Record<string, unknown> | null;
  local: boolean;
  seal_wrap: boolean;
}

// Policy
export interface PolicyResponse {
  name: string;
  rules: string;
}

// Token
export interface TokenLookupResponse {
  request_id: string;
  data: {
    accessor: string;
    creation_time: number;
    creation_ttl: number;
    display_name: string;
    entity_id: string;
    expire_time: string | null;
    explicit_max_ttl: number;
    id: string;
    meta: Record<string, string> | null;
    num_uses: number;
    orphan: boolean;
    path: string;
    policies: string[];
    renewable: boolean;
    ttl: number;
    type: string;
  };
}

// Audit
export interface AuditDevice {
  type: string;
  description: string;
  options: Record<string, string>;
  local: boolean;
  path: string;
}
