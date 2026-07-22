// Cutover: now served by Supabase-backed v2 (was: proxy to Azure VM /analyze).
// Rollback: git revert this file to restore the VM proxy.
export { default, config } from "./v2/analyze.mjs";
