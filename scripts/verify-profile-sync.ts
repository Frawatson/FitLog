// Scenario checks for mergeServerProfile (client/lib/profileSync.ts).
// Run: npx tsx scripts/verify-profile-sync.ts
import { mergeServerProfile, type ServerUser } from "../client/lib/profileSync";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
}

const server: ServerUser = {
  id: 7,
  email: "Frank@example.com",
  name: "Frank",
  age: 31,
  sex: "male",
  heightCm: 180,
  weightKg: 82.5,
  weightGoalKg: 78,
  experience: "intermediate",
  goal: "gain_muscle",
  activityLevel: "3-4",
  unitSystem: "metric",
};

// 1. The reported bug: a home-screen web app starts with EMPTY storage.
{
  const { profile, backfillUnitSystem } = mergeServerProfile(null, server);
  check(profile.age === 31, "fresh storage: age restored from the account");
  check(
    profile.heightCm === 180 && profile.weightKg === 82.5,
    "fresh storage: height + weight restored",
  );
  check(profile.weightGoalKg === 78, "fresh storage: goal weight restored");
  check(
    profile.goal === "gain_muscle" && profile.activityLevel === "3-4",
    "fresh storage: goal + activity restored",
  );
  check(
    profile.unitSystem === "metric",
    "fresh storage: unit preference restored (was reset to imperial)",
  );
  check(
    profile.onboardingCompleted === true,
    "fresh storage: onboarding counted complete",
  );
  check(
    backfillUnitSystem === null,
    "nothing to backfill when the server has units",
  );
}

// 2. Existing user whose unit preference only lives on their original device.
{
  const local = mergeServerProfile(null, {
    ...server,
    unitSystem: "metric",
  }).profile;
  const { profile, backfillUnitSystem } = mergeServerProfile(local, {
    ...server,
    unitSystem: null,
  });
  check(
    profile.unitSystem === "metric",
    "device unit kept when server has none",
  );
  check(
    backfillUnitSystem === "metric",
    "device unit flagged for one-time upload",
  );
}

// 3. Server values win over stale device values (edited on another device).
{
  const stale = mergeServerProfile(null, {
    ...server,
    weightKg: 90,
    age: 30,
  }).profile;
  const { profile } = mergeServerProfile(stale, server);
  check(
    profile.weightKg === 82.5 && profile.age === 31,
    "server overrides stale device values",
  );
  check(
    profile.createdAt === stale.createdAt && profile.id === stale.id,
    "device-only fields (id, createdAt) preserved",
  );
}

// 4. Server field missing -> device value fills the gap.
{
  const local = mergeServerProfile(null, server).profile;
  const { profile } = mergeServerProfile(local, {
    ...server,
    heightCm: null,
    weightGoalKg: undefined,
  });
  check(
    profile.heightCm === 180 && profile.weightGoalKg === 78,
    "gaps filled from the device copy",
  );
}

// 5. A profile left behind by a DIFFERENT account is ignored.
{
  const other = mergeServerProfile(null, {
    ...server,
    email: "someone@else.com",
    unitSystem: "metric",
    age: 55,
  }).profile;
  const { profile, backfillUnitSystem } = mergeServerProfile(other, {
    ...server,
    unitSystem: null,
    age: null,
  });
  check(
    profile.email === "Frank@example.com",
    "other account's profile replaced",
  );
  check(profile.age === undefined, "no data leaks in from the other account");
  check(
    profile.unitSystem === "imperial" && backfillUnitSystem === null,
    "other account's units neither used nor uploaded",
  );
}

// 6. Brand-new account with no details yet.
{
  const { profile } = mergeServerProfile(null, {
    id: 9,
    email: "new@x.com",
    name: "New",
  });
  check(
    profile.unitSystem === "imperial" && profile.onboardingCompleted === false,
    "new account: defaults, onboarding pending",
  );
}

console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
process.exit(failures ? 1 : 0);
