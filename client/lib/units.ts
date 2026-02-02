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
