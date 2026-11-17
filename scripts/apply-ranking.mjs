// Applies an approved change to a results table (a GitHub issue made from the
// "Ranking change" form, or opened by scripts/sync-submissions.mjs) to
// data/rankings.toml.
//
//   ISSUE_BODY=... ISSUE_NUMBER=12 APPROVER=login node scripts/apply-ranking.mjs
//
// The issue text is untrusted input: scripts/ranking-lib.mjs only parses it as
// TOML and checks every key against the table it names.
import fs from "node:fs";
import path from "node:path";
import { ROOT, ProposalError, proposalFromText, mergeProposal, readRankings, writeRankings } from "./ranking-lib.mjs";

const result = (text) => fs.writeFileSync(path.join(ROOT, ".ranking-result"), text + "\n");
try {
  const issue = Number(process.env.ISSUE_NUMBER || 0);
  const approver = (process.env.APPROVER || "").replace(/[^\w-]/g, "");
  const clean = proposalFromText(process.env.ISSUE_BODY);
  const file = path.join(ROOT, "data/rankings.toml");
  writeRankings(file, mergeProposal(readRankings(file), clean, `#${issue} by ${approver} on ${new Date().toISOString().slice(0, 10)}`));
  result(`ok: ${clean.id}`);
  console.log(`Applied the change to ${clean.id}`);
} catch (e) {
  if (!(e instanceof ProposalError)) throw e;
  result(`error: ${e.message}`);
  console.error(e.message);
  process.exit(1);
}
