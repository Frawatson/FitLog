// Checks workout/run history paging: walking every page with a tiny page
// size returns exactly the full history, in order, with no duplicates.
// Read-only against the configured database. Run:
//   npx tsx scripts/verify-history-paging.ts
import "dotenv/config";
import {
  getRuns,
  getWorkouts,
  historyPageSize,
  parseHistoryCursor,
  pool,
} from "../server/db";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
}

check(parseHistoryCursor("junk") === null, "malformed cursor rejected");
check(
  parseHistoryCursor("2026-10-09T04:05:08.464Z|0") === null,
  "non-positive id rejected",
);
check(
  parseHistoryCursor("2026-10-09T04:05:08.464Z|12")?.id === 12,
  "valid cursor parsed",
);
check(
  historyPageSize("500") === 100 && historyPageSize("20") === 20,
  "page size clamped",
);

async function walk(
  fetchPage: (
    before: { ts: string; id: number } | null,
    limit: number,
  ) => Promise<{ items: any[]; nextCursor: string | null }>,
  limit: number,
) {
  const all: any[] = [];
  let before: { ts: string; id: number } | null = null;
  for (let i = 0; i < 1000; i++) {
    const page = await fetchPage(before, limit);
    all.push(...page.items);
    if (!page.nextCursor) break;
    before = parseHistoryCursor(page.nextCursor);
  }
  return all;
}

(async () => {
  const users = await pool.query(
    `SELECT user_id FROM (
       SELECT user_id, count(*) n FROM workouts GROUP BY user_id
       UNION ALL SELECT user_id, count(*) FROM runs GROUP BY user_id) s
     GROUP BY user_id ORDER BY sum(n) DESC LIMIT 3`,
  );
  for (const { user_id: userId } of users.rows) {
    for (const [label, fetchPage] of [
      [
        "workouts",
        (b: any, l: number) => getWorkouts(userId, { before: b, limit: l }),
      ],
      ["runs", (b: any, l: number) => getRuns(userId, { before: b, limit: l })],
    ] as const) {
      const full = (await fetchPage(null, 200)).items.map(
        (x: any) => x.clientId,
      );
      for (const size of [1, 2]) {
        const paged = (await walk(fetchPage, size)).map((x: any) => x.clientId);
        check(
          paged.join() === full.join() && new Set(paged).size === paged.length,
          `user ${userId} ${label}: ${full.length} items, page size ${size} walks all of them in order`,
        );
      }
      const items = (await fetchPage(null, 200)).items;
      const ordered = items.every(
        (x: any, i: number) =>
          i === 0 ||
          Date.parse(items[i - 1].startedAt) >= Date.parse(x.startedAt),
      );
      check(ordered, `user ${userId} ${label}: newest first by start time`);
    }
  }
  console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
  await pool.end();
  process.exit(failures ? 1 : 0);
})();
