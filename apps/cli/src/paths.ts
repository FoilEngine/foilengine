import { fileURLToPath } from 'node:url';

/** Absolute path of the repository root (apps/cli/src → ../../..). */
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
