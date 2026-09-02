/**
 * Standardized process exit codes for the build-with-ak CLI. Machine-readable
 * consumers (CI, agents) branch on these values.
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  VALIDATION_ERROR: 2,
  AUTH_ERROR: 3,
  NOT_FOUND: 4,
  CAS_CONFLICT: 5,
  NETWORK_ERROR: 6,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
