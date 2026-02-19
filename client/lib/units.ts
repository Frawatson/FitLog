import type { UnitSystem } from "@/types";

export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 1 / KG_TO_LBS;
export const CM_TO_INCHES = 0.393701;
export const INCHES_TO_CM = 1 / CM_TO_INCHES;

export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10;
}

export function cmToInches(cm: number): number {
  return Math.round(cm * CM_TO_INCHES * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * INCHES_TO_CM * 10) / 10;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm * CM_TO_INCHES;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return Math.round(totalInches * INCHES_TO_CM);
}

export function formatWeight(kg: number, unitSystem: UnitSystem): string {
  if (unitSystem === "imperial") {
    return `${kgToLbs(kg)} lbs`;
  }
  return `${kg} kg`;
}

export function formatHeight(cm: number, unitSystem: UnitSystem): string {
  if (unitSystem === "imperial") {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${cm} cm`;
}

export function formatWeightValue(kg: number, unitSystem: UnitSystem): number {
  if (unitSystem === "imperial") {
    return kgToLbs(kg);
  }
  return kg;
}

export function parseWeightInput(value: number, unitSystem: UnitSystem): number {
  if (unitSystem === "imperial") {
    return lbsToKg(value);
  }
  return value;
}

export function parseHeightInput(feet: number, inches: number, unitSystem: UnitSystem): number {
  if (unitSystem === "imperial") {
    return feetInchesToCm(feet, inches);
  }
  return feet;
}

export const KM_TO_MILES = 0.621371;
export const MILES_TO_KM = 1 / KM_TO_MILES;

export function kmToMiles(km: number): number {
  return Math.round(km * KM_TO_MILES * 100) / 100;
}

export function milesToKm(miles: number): number {
  return Math.round(miles * MILES_TO_KM * 100) / 100;
}

export function formatDistance(km: number, unitSystem: UnitSystem): string {
  if (unitSystem === "imperial") {
    return `${kmToMiles(km).toFixed(2)} mi`;
  }
  return `${km.toFixed(2)} km`;
}

export function formatDistanceValue(km: number, unitSystem: UnitSystem): number {
  if (unitSystem === "imperial") {
    return kmToMiles(km);
  }
  return km;
}

export function formatDistanceUnit(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "mi" : "km";
}

export function formatPace(paceMinPerKm: number, unitSystem: UnitSystem): string {
  if (!isFinite(paceMinPerKm) || paceMinPerKm <= 0 || paceMinPerKm > 60) return "--:--";
  const pace = unitSystem === "imperial" ? paceMinPerKm / KM_TO_MILES : paceMinPerKm;
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatPaceUnit(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "/mi" : "/km";
}

export function formatSpeedValue(km: number, durationSeconds: number, unitSystem: UnitSystem): number {
  if (durationSeconds <= 0 || km <= 0) return 0;
  if (unitSystem === "imperial") {
    return Math.round(kmToMiles(km) / (durationSeconds / 3600) * 100) / 100;
  }
  return Math.round(km / (durationSeconds / 3600) * 100) / 100;
}

export function formatSpeedUnit(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "mph" : "km/h";
}

export function weightLabel(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "lbs" : "kg";
}
