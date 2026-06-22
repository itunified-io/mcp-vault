/**
 * Shared Zod schemas for Vault tool validation.
 */

import { z } from "zod";

export const SecretPathSchema = z
  .string()
  .min(1, "Secret path is required")
  .regex(/^[a-zA-Z0-9_\-/.]+$/, "Invalid secret path characters");

export const MountPathSchema = z
  .string()
  .min(1, "Mount path is required")
  .regex(/^[a-zA-Z0-9_\-/]+$/, "Invalid mount path characters");

export const PolicyNameSchema = z
  .string()
  .min(1, "Policy name is required")
  .regex(/^[a-zA-Z0-9_\-]+$/, "Invalid policy name characters");

export const AuthMethodTypeSchema = z.enum([
  "kubernetes",
  "approle",
  "token",
  "userpass",
  "ldap",
  "oidc",
  "cert",
  "github",
  "aws",
  "gcp",
  "azure",
]);

export const EngineTypeSchema = z.enum([
  "kv",
  "kv-v2",
  "pki",
  "transit",
  "database",
  "aws",
  "ssh",
  "totp",
  "cubbyhole",
  "identity",
]);

export const ConfirmSchema = z.literal(true, {
  errorMap: () => ({
    message:
      "confirm must be explicitly set to true to perform this operation",
  }),
});
