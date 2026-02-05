import type { HeartRateZone, HeartRateZoneInfo } from "@/types";

export function calculateMaxHeartRate(age: number): number {
  return 220 - age;
}

export function getHeartRateZones(age: number): HeartRateZoneInfo[] {
  const maxHR = calculateMaxHeartRate(age);
  
  return [
    {
      zone: "zone1",
      name: "Warm Up",
      minBpm: Math.round(maxHR * 0.5),
      maxBpm: Math.round(maxHR * 0.6),
      color: "#90CAF9",
      description: "Very light effort, recovery",
    },
    {
      zone: "zone2",
      name: "Fat Burn",
      minBpm: Math.round(maxHR * 0.6),
      maxBpm: Math.round(maxHR * 0.7),
      color: "#4CAF50",
      description: "Light effort, base endurance",
    },
    {
      zone: "zone3",
      name: "Cardio",
      minBpm: Math.round(maxHR * 0.7),
      maxBpm: Math.round(maxHR * 0.8),
      color: "#FFEB3B",
      description: "Moderate effort, aerobic fitness",
    },
    {
      zone: "zone4",
      name: "Threshold",
      minBpm: Math.round(maxHR * 0.8),
      maxBpm: Math.round(maxHR * 0.9),
      color: "#FF9800",
      description: "Hard effort, anaerobic threshold",
    },
    {
      zone: "zone5",
      name: "Max Effort",
      minBpm: Math.round(maxHR * 0.9),
      maxBpm: maxHR,
      color: "#F44336",
      description: "Maximum effort, peak performance",
    },
  ];
}

export function getZoneForHeartRate(heartRate: number, age: number): HeartRateZoneInfo | null {
  const zones = getHeartRateZones(age);
  
  for (const zone of zones) {
    if (heartRate >= zone.minBpm && heartRate <= zone.maxBpm) {
      return zone;
    }
  }
  
  if (heartRate < zones[0].minBpm) {
    return zones[0];
  }
  
  if (heartRate > zones[4].maxBpm) {
    return zones[4];
  }
  
  return null;
}

export function getZoneColor(zone: HeartRateZone): string {
  const colors: Record<HeartRateZone, string> = {
    zone1: "#90CAF9",
    zone2: "#4CAF50",
    zone3: "#FFEB3B",
    zone4: "#FF9800",
    zone5: "#F44336",
  };
  return colors[zone];
}

export function getZoneName(zone: HeartRateZone): string {
  const names: Record<HeartRateZone, string> = {
    zone1: "Warm Up",
    zone2: "Fat Burn",
    zone3: "Cardio",
    zone4: "Threshold",
    zone5: "Max Effort",
  };
  return names[zone];
}
