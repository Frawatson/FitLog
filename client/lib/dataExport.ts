import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import * as storage from "@/lib/storage";
import { getLocalDateString } from "@/lib/dateUtils";

// Lifted out of ProfileScreen so the Settings screen can call it too.
// Pure utility — no UI state of its own. Caller handles the user-facing
// success/failure feedback (alerts, toasts) since the right surface
// differs per call site.
//
// Returns an `outcome` instead of throwing so callers can render a
// platform-appropriate message (web alert vs native Alert vs in-app toast).
export type ExportOutcome =
  | { ok: true; shared: boolean }
  | { ok: false; reason: "sharing-unavailable" | "error"; message?: string };

function escapeCSV(val: unknown): string {
  const str = String(val ?? "");
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export async function exportUserDataCsv(): Promise<ExportOutcome> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: "sharing-unavailable" };
    }

    const [workouts, runs, bodyWeights, foodLog] = await Promise.all([
      storage.getWorkouts(),
      storage.getRunHistory(),
      storage.getBodyWeights(),
      storage.getFoodLog(),
    ]);

    const workoutRows = ["Date,Routine,Duration (min),Exercises,Total Sets"];
    for (const w of workouts) {
      const exercises = w.exercises?.map((e) => e.exerciseName).join("; ") || "";
      const totalSets = w.exercises?.reduce((sum, e) => sum + (e.sets?.length || 0), 0) || 0;
      workoutRows.push(
        [
          escapeCSV(w.startedAt?.split("T")[0] || w.completedAt?.split("T")[0] || ""),
          escapeCSV(w.routineName || ""),
          w.durationMinutes || 0,
          escapeCSV(exercises),
          totalSets,
        ].join(","),
      );
    }

    const runRows = ["Date,Distance (km),Duration (min),Pace (min/km)"];
    for (const r of runs) {
      const durationMin = Math.round((r.durationSeconds || 0) / 60);
      const pace = r.distanceKm > 0
        ? ((r.durationSeconds || 0) / 60 / r.distanceKm).toFixed(2)
        : "";
      runRows.push(
        [escapeCSV(r.startedAt?.split("T")[0] || ""), r.distanceKm.toFixed(2), durationMin, pace].join(","),
      );
    }

    const bwRows = ["Date,Weight (kg)"];
    for (const bw of bodyWeights) {
      bwRows.push([escapeCSV(bw.date), bw.weightKg].join(","));
    }

    const foodRows = ["Date,Food,Calories,Protein (g),Carbs (g),Fat (g)"];
    for (const f of foodLog) {
      foodRows.push(
        [
          escapeCSV(f.date),
          escapeCSV(f.food.name),
          f.food.calories,
          f.food.protein,
          f.food.carbs,
          f.food.fat,
        ].join(","),
      );
    }

    const timestamp = getLocalDateString();
    const summary = [
      `Gbolo Data Export - ${timestamp}`,
      "",
      `Workouts: ${workouts.length} records`,
      `Runs: ${runs.length} records`,
      `Body Weights: ${bodyWeights.length} records`,
      `Nutrition: ${foodLog.length} records`,
      "",
      "--- WORKOUTS ---",
      workoutRows.join("\n"),
      "",
      "--- RUNS ---",
      runRows.join("\n"),
      "",
      "--- BODY WEIGHT ---",
      bwRows.join("\n"),
      "",
      "--- NUTRITION ---",
      foodRows.join("\n"),
    ].join("\n");

    const file = new File(Paths.cache, `gbolo_export_${timestamp}.csv`);
    file.write(summary);

    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      dialogTitle: "Export Gbolo Data",
    });

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    return { ok: true, shared: true };
  } catch (error) {
    console.error("Export error:", error);
    return { ok: false, reason: "error", message: (error as Error)?.message };
  }
}
