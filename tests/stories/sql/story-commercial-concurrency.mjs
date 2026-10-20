// Reuse the real two-connection A16D harness against the same isolated Docker
// database, with commercial fixtures, approval invalidation and reapproval races.
process.argv.push("--commercial");
await import("./story-concurrency.mjs");
