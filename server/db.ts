import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        age INTEGER,
        sex VARCHAR(10),
        height_cm REAL,
        weight_kg REAL,
        weight_goal_kg REAL,
        experience VARCHAR(50),
        goal VARCHAR(50),
        activity_level VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add weight_goal_kg column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'weight_goal_kg') THEN
          ALTER TABLE users ADD COLUMN weight_goal_kg REAL;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        PRIMARY KEY (sid)
      );

      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
      
      CREATE TABLE IF NOT EXISTS body_weights (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        weight_kg REAL NOT NULL,
        date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS IDX_body_weights_user_id ON body_weights (user_id);
      CREATE INDEX IF NOT EXISTS IDX_body_weights_date ON body_weights (user_id, date DESC);
      
      -- Macro targets table
      CREATE TABLE IF NOT EXISTS macro_targets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        calories INTEGER NOT NULL,
        protein INTEGER NOT NULL,
        carbs INTEGER NOT NULL,
        fat INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
      
      -- Routines table
      CREATE TABLE IF NOT EXISTS routines (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        exercises JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_completed_at TIMESTAMP,
        UNIQUE(user_id, client_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_routines_user_id ON routines (user_id);
      
      -- Workouts table (completed workouts)
      CREATE TABLE IF NOT EXISTS workouts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id VARCHAR(255) NOT NULL,
        routine_id VARCHAR(255),
        routine_name VARCHAR(255),
        exercises JSONB NOT NULL DEFAULT '[]',
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        duration_minutes INTEGER,
        UNIQUE(user_id, client_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_workouts_user_id ON workouts (user_id);
      CREATE INDEX IF NOT EXISTS IDX_workouts_completed ON workouts (user_id, completed_at DESC);
      
      -- Runs table
      CREATE TABLE IF NOT EXISTS runs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id VARCHAR(255) NOT NULL,
        distance_km REAL NOT NULL,
        duration_seconds INTEGER NOT NULL,
        pace_min_per_km REAL NOT NULL,
        calories INTEGER,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP NOT NULL,
        route JSONB,
        UNIQUE(user_id, client_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_runs_user_id ON runs (user_id);
      CREATE INDEX IF NOT EXISTS IDX_runs_completed ON runs (user_id, completed_at DESC);
      
      -- Food log table
      CREATE TABLE IF NOT EXISTS food_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id VARCHAR(255) NOT NULL,
        food_data JSONB NOT NULL,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, client_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_food_logs_user_id ON food_logs (user_id);
      CREATE INDEX IF NOT EXISTS IDX_food_logs_date ON food_logs (user_id, date DESC);
      
      -- Login attempts table for account lockout
      CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        attempt_count INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS IDX_login_attempts_email ON login_attempts (email);
      
      -- Password reset codes table
      CREATE TABLE IF NOT EXISTS password_reset_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS IDX_password_reset_codes_user ON password_reset_codes (user_id);
      
      -- Custom exercises table
      CREATE TABLE IF NOT EXISTS custom_exercises (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        muscle_group VARCHAR(100) NOT NULL,
        is_custom BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, client_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_custom_exercises_user_id ON custom_exercises (user_id);

      -- Saved foods table
      CREATE TABLE IF NOT EXISTS saved_foods (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        food_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS IDX_saved_foods_user_id ON saved_foods (user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS IDX_saved_foods_unique ON saved_foods (user_id, (food_data->>'id'));

      -- Notification preferences table
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workout_reminders BOOLEAN DEFAULT FALSE,
        streak_alerts BOOLEAN DEFAULT FALSE,
        reminder_hour INTEGER DEFAULT 18,
        reminder_minute INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );

      -- Add streak tracking columns to users table
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_streak') THEN
          ALTER TABLE users ADD COLUMN current_streak INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'longest_streak') THEN
          ALTER TABLE users ADD COLUMN longest_streak INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_activity_date') THEN
          ALTER TABLE users ADD COLUMN last_activity_date DATE;
        END IF;
      END $$;
    `);
    console.log("Database tables initialized");
  } finally {
    client.release();
  }
}

export async function getUserByEmail(email: string) {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

export async function getUserById(id: number) {
  const result = await pool.query(
    "SELECT id, email, name, age, sex, height_cm, weight_kg, weight_goal_kg, experience, goal, activity_level, created_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  name: string;
}) {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, name) 
     VALUES ($1, $2, $3) 
     RETURNING id, email, name, created_at`,
    [data.email.toLowerCase(), data.passwordHash, data.name]
  );
  return result.rows[0];
}

export async function updateUserProfile(id: number, data: {
  name?: string;
  age?: number;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  weightGoalKg?: number;
  experience?: string;
  goal?: string;
  activityLevel?: string;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.age !== undefined) {
    fields.push(`age = $${paramIndex++}`);
    values.push(data.age);
  }
  if (data.sex !== undefined) {
    fields.push(`sex = $${paramIndex++}`);
    values.push(data.sex);
  }
  if (data.heightCm !== undefined) {
    fields.push(`height_cm = $${paramIndex++}`);
    values.push(data.heightCm);
  }
  if (data.weightKg !== undefined) {
    fields.push(`weight_kg = $${paramIndex++}`);
    values.push(data.weightKg);
  }
  if (data.weightGoalKg !== undefined) {
    fields.push(`weight_goal_kg = $${paramIndex++}`);
    values.push(data.weightGoalKg);
  }
  if (data.experience !== undefined) {
    fields.push(`experience = $${paramIndex++}`);
    values.push(data.experience);
  }
  if (data.goal !== undefined) {
    fields.push(`goal = $${paramIndex++}`);
    values.push(data.goal);
  }
  if (data.activityLevel !== undefined) {
    fields.push(`activity_level = $${paramIndex++}`);
    values.push(data.activityLevel);
  }

  if (fields.length === 0) {
    return getUserById(id);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${paramIndex} 
     RETURNING id, email, name, age, sex, height_cm, weight_kg, weight_goal_kg, experience, goal, activity_level`,
    values
  );
  return result.rows[0];
}

export async function deleteUser(id: number): Promise<boolean> {
  const user = await getUserById(id);
  if (user) {
    await pool.query("DELETE FROM login_attempts WHERE email = $1", [user.email]);
  }
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export interface BodyWeightEntry {
  id: number;
  userId: number;
  weightKg: number;
  date: string;
  createdAt: string;
}

export async function getBodyWeights(userId: number): Promise<BodyWeightEntry[]> {
  const result = await pool.query(
    `SELECT id, user_id, weight_kg, date, created_at 
     FROM body_weights 
     WHERE user_id = $1 
     ORDER BY date DESC 
     LIMIT 100`,
    [userId]
  );
  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    weightKg: row.weight_kg,
    date: row.date.toISOString(),
    createdAt: row.created_at.toISOString(),
  }));
}

export async function addBodyWeight(userId: number, weightKg: number, date: Date): Promise<BodyWeightEntry> {
  const result = await pool.query(
    `INSERT INTO body_weights (user_id, weight_kg, date) 
     VALUES ($1, $2, $3) 
     RETURNING id, user_id, weight_kg, date, created_at`,
    [userId, weightKg, date]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    weightKg: row.weight_kg,
    date: row.date.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

export async function deleteBodyWeight(userId: number, id: number): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM body_weights WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// Macro Targets
export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function getMacroTargets(userId: number): Promise<MacroTargets | null> {
  const result = await pool.query(
    "SELECT calories, protein, carbs, fat FROM macro_targets WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

export async function saveMacroTargets(userId: number, targets: MacroTargets): Promise<MacroTargets> {
  const result = await pool.query(
    `INSERT INTO macro_targets (user_id, calories, protein, carbs, fat)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       calories = EXCLUDED.calories,
       protein = EXCLUDED.protein,
       carbs = EXCLUDED.carbs,
       fat = EXCLUDED.fat,
       updated_at = CURRENT_TIMESTAMP
     RETURNING calories, protein, carbs, fat`,
    [userId, targets.calories, targets.protein, targets.carbs, targets.fat]
  );
  return result.rows[0];
}

// Routines
export interface RoutineData {
  clientId: string;
  name: string;
  exercises: any[];
  createdAt: string;
  lastCompletedAt?: string;
}

export async function getRoutines(userId: number): Promise<RoutineData[]> {
  const result = await pool.query(
    `SELECT client_id, name, exercises, created_at, last_completed_at 
     FROM routines WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(row => ({
    clientId: row.client_id,
    name: row.name,
    exercises: row.exercises,
    createdAt: row.created_at.toISOString(),
    lastCompletedAt: row.last_completed_at?.toISOString(),
  }));
}

export async function saveRoutine(userId: number, routine: RoutineData): Promise<void> {
  await pool.query(
    `INSERT INTO routines (user_id, client_id, name, exercises, created_at, last_completed_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       name = EXCLUDED.name,
       exercises = EXCLUDED.exercises,
       last_completed_at = EXCLUDED.last_completed_at`,
    [userId, routine.clientId, routine.name, JSON.stringify(routine.exercises), 
     routine.createdAt, routine.lastCompletedAt || null]
  );
}

export async function deleteRoutine(userId: number, clientId: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM routines WHERE user_id = $1 AND client_id = $2 RETURNING id",
    [userId, clientId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// Workouts
export interface WorkoutData {
  clientId: string;
  routineId?: string;
  routineName?: string;
  exercises: any[];
  startedAt: string;
  completedAt?: string;
  durationMinutes?: number;
}

export async function getWorkouts(userId: number): Promise<WorkoutData[]> {
  const result = await pool.query(
    `SELECT client_id, routine_id, routine_name, exercises, started_at, completed_at, duration_minutes
     FROM workouts WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 100`,
    [userId]
  );
  return result.rows.map(row => ({
    clientId: row.client_id,
    routineId: row.routine_id,
    routineName: row.routine_name,
    exercises: row.exercises,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    durationMinutes: row.duration_minutes,
  }));
}

export async function saveWorkout(userId: number, workout: WorkoutData): Promise<void> {
  await pool.query(
    `INSERT INTO workouts (user_id, client_id, routine_id, routine_name, exercises, started_at, completed_at, duration_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       routine_id = EXCLUDED.routine_id,
       routine_name = EXCLUDED.routine_name,
       exercises = EXCLUDED.exercises,
       started_at = EXCLUDED.started_at,
       completed_at = EXCLUDED.completed_at,
       duration_minutes = EXCLUDED.duration_minutes`,
    [userId, workout.clientId, workout.routineId, workout.routineName, 
     JSON.stringify(workout.exercises), workout.startedAt, workout.completedAt, workout.durationMinutes]
  );
}

// Runs
export interface RunData {
  clientId: string;
  distanceKm: number;
  durationSeconds: number;
  paceMinPerKm: number;
  calories?: number;
  startedAt: string;
  completedAt: string;
  route?: any[];
}

export async function getRuns(userId: number): Promise<RunData[]> {
  const result = await pool.query(
    `SELECT client_id, distance_km, duration_seconds, pace_min_per_km, calories, started_at, completed_at, route
     FROM runs WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 100`,
    [userId]
  );
  return result.rows.map(row => ({
    clientId: row.client_id,
    distanceKm: row.distance_km,
    durationSeconds: row.duration_seconds,
    paceMinPerKm: row.pace_min_per_km,
    calories: row.calories,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at.toISOString(),
    route: row.route,
  }));
}

export async function saveRun(userId: number, run: RunData): Promise<void> {
  await pool.query(
    `INSERT INTO runs (user_id, client_id, distance_km, duration_seconds, pace_min_per_km, calories, started_at, completed_at, route)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       distance_km = EXCLUDED.distance_km,
       duration_seconds = EXCLUDED.duration_seconds,
       pace_min_per_km = EXCLUDED.pace_min_per_km,
       calories = EXCLUDED.calories,
       started_at = EXCLUDED.started_at,
       completed_at = EXCLUDED.completed_at,
       route = EXCLUDED.route`,
    [userId, run.clientId, run.distanceKm, run.durationSeconds, run.paceMinPerKm, 
     run.calories, run.startedAt, run.completedAt, run.route ? JSON.stringify(run.route) : null]
  );
}

// Food Logs
export interface FoodLogData {
  clientId: string;
  foodData: any;
  date: string;
  createdAt: string;
}

export async function getFoodLogs(userId: number, date?: string): Promise<FoodLogData[]> {
  let query = `SELECT client_id, food_data, date, created_at FROM food_logs WHERE user_id = $1`;
  const params: any[] = [userId];
  
  if (date) {
    query += ` AND date = $2`;
    params.push(date);
  }
  
  query += ` ORDER BY created_at DESC LIMIT 500`;
  
  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    clientId: row.client_id,
    foodData: row.food_data,
    date: row.date.toISOString().split('T')[0],
    createdAt: row.created_at.toISOString(),
  }));
}

export async function saveFoodLog(userId: number, log: FoodLogData): Promise<void> {
  await pool.query(
    `INSERT INTO food_logs (user_id, client_id, food_data, date, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       food_data = EXCLUDED.food_data,
       date = EXCLUDED.date`,
    [userId, log.clientId, JSON.stringify(log.foodData), log.date, log.createdAt]
  );
}

export async function deleteFoodLog(userId: number, clientId: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM food_logs WHERE user_id = $1 AND client_id = $2 RETURNING id",
    [userId, clientId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// Streak tracking functions
export async function getUserStreak(userId: number): Promise<{ currentStreak: number; longestStreak: number; lastActivityDate: string | null }> {
  const result = await pool.query(
    "SELECT current_streak, longest_streak, last_activity_date FROM users WHERE id = $1",
    [userId]
  );
  if (result.rows.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  }
  const row = result.rows[0];
  return {
    currentStreak: row.current_streak || 0,
    longestStreak: row.longest_streak || 0,
    lastActivityDate: row.last_activity_date ? row.last_activity_date.toISOString().split('T')[0] : null,
  };
}

export async function createPasswordResetCode(userId: number): Promise<string> {
  await pool.query("DELETE FROM password_reset_codes WHERE user_id = $1", [userId]);
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query(
    `INSERT INTO password_reset_codes (user_id, code, expires_at) VALUES ($1, $2, $3)`,
    [userId, code, expiresAt]
  );
  return code;
}

export async function verifyPasswordResetCode(email: string, code: string): Promise<{ valid: boolean; userId: number | null }> {
  const result = await pool.query(
    `SELECT prc.id, prc.user_id, prc.expires_at, prc.used
     FROM password_reset_codes prc
     JOIN users u ON u.id = prc.user_id
     WHERE u.email = $1 AND prc.code = $2
     ORDER BY prc.created_at DESC LIMIT 1`,
    [email.toLowerCase(), code]
  );
  if (result.rows.length === 0) {
    return { valid: false, userId: null };
  }
  const row = result.rows[0];
  if (row.used || new Date(row.expires_at) < new Date()) {
    return { valid: false, userId: null };
  }
  return { valid: true, userId: row.user_id };
}

export async function markResetCodeUsed(email: string, code: string): Promise<void> {
  await pool.query(
    `UPDATE password_reset_codes SET used = TRUE
     WHERE user_id = (SELECT id FROM users WHERE email = $1) AND code = $2`,
    [email.toLowerCase(), code]
  );
}

export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  await pool.query(
    "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [passwordHash, userId]
  );
}

export async function updateUserStreak(userId: number): Promise<{ currentStreak: number; longestStreak: number }> {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Get current streak data
  const current = await getUserStreak(userId);
  
  let newStreak = current.currentStreak;
  let newLongest = current.longestStreak;
  
  if (current.lastActivityDate === today) {
    // Already logged today, no change
    return { currentStreak: newStreak, longestStreak: newLongest };
  } else if (current.lastActivityDate === yesterday) {
    // Consecutive day - increment streak
    newStreak = current.currentStreak + 1;
  } else {
    // Streak broken or first activity - reset to 1
    newStreak = 1;
  }
  
  // Update longest streak if needed
  if (newStreak > newLongest) {
    newLongest = newStreak;
  }
  
  // Save to database
  await pool.query(
    `UPDATE users SET current_streak = $1, longest_streak = $2, last_activity_date = $3, updated_at = NOW() WHERE id = $4`,
    [newStreak, newLongest, today, userId]
  );
  
  return { currentStreak: newStreak, longestStreak: newLongest };
}

// Custom Exercises
export interface CustomExerciseData {
  clientId: string;
  name: string;
  muscleGroup: string;
  isCustom: boolean;
}

export async function getCustomExercises(userId: number): Promise<CustomExerciseData[]> {
  const result = await pool.query(
    `SELECT client_id, name, muscle_group, is_custom FROM custom_exercises WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map(row => ({
    clientId: row.client_id,
    name: row.name,
    muscleGroup: row.muscle_group,
    isCustom: row.is_custom,
  }));
}

export async function saveCustomExercise(userId: number, exercise: CustomExerciseData): Promise<void> {
  await pool.query(
    `INSERT INTO custom_exercises (user_id, client_id, name, muscle_group, is_custom)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       name = EXCLUDED.name,
       muscle_group = EXCLUDED.muscle_group,
       is_custom = EXCLUDED.is_custom`,
    [userId, exercise.clientId, exercise.name, exercise.muscleGroup, exercise.isCustom]
  );
}

export async function deleteCustomExercise(userId: number, clientId: string): Promise<void> {
  await pool.query(
    "DELETE FROM custom_exercises WHERE user_id = $1 AND client_id = $2",
    [userId, clientId]
  );
}

// Saved Foods
export async function getSavedFoods(userId: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT food_data FROM saved_foods WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map(row => row.food_data);
}

export async function saveSavedFood(userId: number, foodData: any): Promise<void> {
  await pool.query(
    `INSERT INTO saved_foods (user_id, food_data)
     VALUES ($1, $2)
     ON CONFLICT (user_id, (food_data->>'id')) DO UPDATE SET
       food_data = EXCLUDED.food_data`,
    [userId, JSON.stringify(foodData)]
  );
}

export async function deleteSavedFood(userId: number, foodId: string): Promise<void> {
  await pool.query(
    "DELETE FROM saved_foods WHERE user_id = $1 AND food_data->>'id' = $2",
    [userId, foodId]
  );
}

// Notification Preferences
export interface NotificationPrefsData {
  workoutReminders: boolean;
  streakAlerts: boolean;
  reminderHour: number;
  reminderMinute: number;
}

export async function getNotificationPrefs(userId: number): Promise<NotificationPrefsData | null> {
  const result = await pool.query(
    "SELECT workout_reminders, streak_alerts, reminder_hour, reminder_minute FROM notification_preferences WHERE user_id = $1",
    [userId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    workoutReminders: row.workout_reminders,
    streakAlerts: row.streak_alerts,
    reminderHour: row.reminder_hour,
    reminderMinute: row.reminder_minute,
  };
}

export async function saveNotificationPrefs(userId: number, prefs: NotificationPrefsData): Promise<void> {
  await pool.query(
    `INSERT INTO notification_preferences (user_id, workout_reminders, streak_alerts, reminder_hour, reminder_minute)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       workout_reminders = EXCLUDED.workout_reminders,
       streak_alerts = EXCLUDED.streak_alerts,
       reminder_hour = EXCLUDED.reminder_hour,
       reminder_minute = EXCLUDED.reminder_minute,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, prefs.workoutReminders, prefs.streakAlerts, prefs.reminderHour, prefs.reminderMinute]
  );
}
