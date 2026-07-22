// Cutover: now served by Supabase-backed v2 (was: proxy to Azure VM /match-job).
// Rollback: git revert this file to restore the VM proxy.
export { default } from "./v2/match-job.mjs";
