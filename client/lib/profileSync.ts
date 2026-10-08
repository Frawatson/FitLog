import type { UserProfile, UnitSystem } from "@/types";

// The account fields the server returns for the signed-in user.
export interface ServerUser {
  id: number;
  email: string;
  name: string;
  age?: number | null;
  sex?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  weightGoalKg?: number | null;
  experience?: string | null;
  goal?: string | null;
  activityLevel?: string | null;
  unitSystem?: UnitSystem | null;
}

// Merge the server's copy of the account into the on-device profile.
// Every screen reads height/weight/age/units from the local profile, but
// it used to be filled only during onboarding on the original device —
// so any fresh storage (a phone's home-screen web app, Safari clearing
// site data after a week of no visits, a new browser) showed every
// detail blank except the name.
//
// Server values win when present; the device fills gaps. A profile that
// belongs to a different account is ignored. `backfillUnitSystem` is set
// when the device knows the unit preference but the server doesn't yet
// (preferences saved before the server stored them) so the caller can
// upload it once.
export function mergeServerProfile(
  local: UserProfile | null,
  server: ServerUser,
  now: () => string = () => new Date().toISOString(),
): { profile: UserProfile; backfillUnitSystem: UnitSystem | null } {
  const sameAccount =
    !local?.email ||
    local.email.toLowerCase() === (server.email || "").toLowerCase();
  const base = sameAccount ? local : null;

  const pick = <T>(
    serverValue: T | null | undefined,
    deviceValue: T | undefined,
  ) =>
    serverValue !== null && serverValue !== undefined
      ? serverValue
      : deviceValue;

  const profile: UserProfile = {
    ...(base ?? ({} as UserProfile)),
    id: base?.id || `user-${server.id}`,
    name: server.name,
    email: server.email,
    age: pick(server.age, base?.age) as number,
    sex: pick(server.sex, base?.sex) as UserProfile["sex"],
    heightCm: pick(server.heightCm, base?.heightCm) as number,
    weightKg: pick(server.weightKg, base?.weightKg) as number,
    weightGoalKg: pick(server.weightGoalKg, base?.weightGoalKg) ?? undefined,
    experience: pick(
      server.experience,
      base?.experience,
    ) as UserProfile["experience"],
    goal: pick(server.goal, base?.goal) as UserProfile["goal"],
    activityLevel: pick(
      server.activityLevel,
      base?.activityLevel,
    ) as UserProfile["activityLevel"],
    unitSystem: server.unitSystem ?? base?.unitSystem ?? "imperial",
    onboardingCompleted:
      base?.onboardingCompleted ?? Boolean(server.goal && server.activityLevel),
    createdAt: base?.createdAt || now(),
  };

  const backfillUnitSystem =
    !server.unitSystem && base?.unitSystem ? base.unitSystem : null;
  return { profile, backfillUnitSystem };
}
