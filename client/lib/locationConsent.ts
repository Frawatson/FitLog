import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

// The app's own record of whether the user allowed location for runs.
// iOS home-screen web apps report geolocation as "prompt" on every
// launch even after it was allowed, so the browser's answer alone made
// each run start over with a permission request. Approval is kept until
// the user turns it off in Settings (or the browser/OS actually denies).

const KEY = "@location_consent";

export type LocationConsent = "granted" | "revoked" | null;

export async function getLocationConsent(): Promise<LocationConsent> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === "granted" || v === "revoked" ? v : null;
  } catch {
    return null;
  }
}

export async function setLocationConsent(
  value: LocationConsent,
): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(KEY, value);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode): fall back to asking each time.
  }
}

// Combine the stored approval with what the browser/OS reports.
export function effectivePermission(
  system: Location.PermissionStatus,
  consent: LocationConsent,
): Location.PermissionStatus {
  if (consent === "revoked") return Location.PermissionStatus.UNDETERMINED;
  if (system === Location.PermissionStatus.DENIED) {
    return Location.PermissionStatus.DENIED;
  }
  if (system === Location.PermissionStatus.GRANTED || consent === "granted") {
    return Location.PermissionStatus.GRANTED;
  }
  return Location.PermissionStatus.UNDETERMINED;
}

async function systemStatus(): Promise<Location.PermissionStatus> {
  try {
    return (await Location.getForegroundPermissionsAsync()).status;
  } catch {
    // navigator.permissions missing (older browsers): unknown.
    return Location.PermissionStatus.UNDETERMINED;
  }
}

export async function checkLocationPermission(): Promise<Location.PermissionStatus> {
  const [system, consent] = await Promise.all([
    systemStatus(),
    getLocationConsent(),
  ]);
  if (system === Location.PermissionStatus.DENIED && consent === "granted") {
    // Turned off in the browser/OS since: forget the old approval.
    await setLocationConsent(null);
  }
  return effectivePermission(system, consent);
}

export async function requestLocationPermission(): Promise<Location.PermissionStatus> {
  let status: Location.PermissionStatus;
  try {
    status = (await Location.requestForegroundPermissionsAsync()).status;
  } catch {
    status = Location.PermissionStatus.UNDETERMINED;
  }
  if (status === Location.PermissionStatus.GRANTED) {
    await setLocationConsent("granted");
  }
  return status;
}

// Settings: stop using location until the user allows it again.
export async function revokeLocationConsent(): Promise<void> {
  await setLocationConsent("revoked");
}
