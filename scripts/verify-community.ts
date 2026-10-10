// Read-only checks for community data against the configured database.
// Run: npx tsx scripts/verify-community.ts
import "dotenv/config";
import {
  pool,
  getSocialProfile,
  getFollowers,
  getFollowing,
  getFeedPosts,
  getUserPosts,
  canViewProfileContent,
} from "../server/db";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
}

async function allPages(
  fetchPage: (
    cursor?: string,
  ) => Promise<{ posts: { id: number }[]; nextCursor?: string }>,
): Promise<number[]> {
  const ids: number[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 100; i++) {
    const page = await fetchPage(cursor);
    ids.push(...page.posts.map((p) => p.id));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return ids;
}

(async () => {
  const users = (await pool.query("SELECT id FROM users ORDER BY id")).rows.map(
    (r) => r.id as number,
  );

  // 1. Counts match the lists each viewer can open, for every viewer.
  for (const target of users) {
    for (const viewer of users) {
      const profile = await getSocialProfile(target, viewer);
      const followers = await getFollowers(target, viewer, 0, 1000);
      const following = await getFollowing(target, viewer, 0, 1000);
      check(
        profile!.followersCount === followers.length &&
          profile!.followingCount === following.length,
        `user ${target} seen by ${viewer}: followers ${profile!.followersCount}/${followers.length}, following ${profile!.followingCount}/${following.length}`,
      );
    }
  }

  // 2. Paging in small pages returns exactly what one big page returns.
  for (const viewer of users) {
    const big = (await getFeedPosts(viewer, undefined, 500)).posts.map(
      (p) => p.id,
    );
    const paged = await allPages((c) => getFeedPosts(viewer, c, 2));
    check(
      JSON.stringify(big) === JSON.stringify(paged),
      `feed for user ${viewer}: ${paged.length} posts paged by 2 == single page (${big.length})`,
    );
    check(
      new Set(paged).size === paged.length,
      `feed for user ${viewer}: no duplicates across pages`,
    );
  }
  for (const target of users) {
    for (const viewer of users) {
      const big = (
        await getUserPosts(target, viewer, undefined, 500)
      ).posts.map((p) => p.id);
      const paged = await allPages((c) => getUserPosts(target, viewer, c, 2));
      check(
        JSON.stringify(big) === JSON.stringify(paged),
        `posts of ${target} seen by ${viewer}: paged by 2 == single page (${big.length})`,
      );
    }
  }

  // 3. Legacy timestamp-only cursors still work.
  const first = await getFeedPosts(users[0], undefined, 2);
  if (first.nextCursor) {
    const legacy = await getFeedPosts(
      users[0],
      first.nextCursor.split("|")[0],
      2,
    );
    check(Array.isArray(legacy.posts), "legacy timestamp-only cursor accepted");
  }

  // 4. Profile visibility helper agrees with the profile flags.
  for (const target of users) {
    for (const viewer of users) {
      const p = await getSocialProfile(target, viewer);
      const expected = target === viewer || p!.isPublic || p!.isFollowedByMe;
      check(
        (await canViewProfileContent(target, viewer)) === expected,
        `canViewProfileContent(${target}, ${viewer}) = ${expected}`,
      );
    }
  }

  console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
  await pool.end();
  process.exit(failures ? 1 : 0);
})();
