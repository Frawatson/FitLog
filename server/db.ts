import { Pool, types } from "pg";

// Force pg to parse TIMESTAMP (without timezone) as UTC
types.setTypeParser(1114, (str: string) => new Date(str + "Z"));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 30,
  idleTimeoutMillis: 30000,
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

      -- Add password_changed_at column if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_changed_at') THEN
          ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP;
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
      
      -- Add image_data column to food_logs if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'food_logs' AND column_name = 'image_data') THEN
          ALTER TABLE food_logs ADD COLUMN image_data TEXT;
        END IF;
      END $$;

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

      -- ========== Sprint 1: Indexes & Constraints ==========

      -- Performance indexes
      CREATE INDEX IF NOT EXISTS IDX_body_weights_trend ON body_weights (user_id, date DESC, weight_kg);
      CREATE INDEX IF NOT EXISTS IDX_workouts_routine ON workouts (user_id, routine_id);
      CREATE INDEX IF NOT EXISTS IDX_runs_distance ON runs (user_id, distance_km DESC);
      CREATE INDEX IF NOT EXISTS IDX_food_logs_daily ON food_logs (user_id, date, created_at DESC);

      -- CHECK constraints (use DO block to avoid errors on re-run)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_body_weights_range') THEN
          ALTER TABLE body_weights ADD CONSTRAINT chk_body_weights_range CHECK (weight_kg BETWEEN 20 AND 500);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_macro_targets_calories') THEN
          ALTER TABLE macro_targets ADD CONSTRAINT chk_macro_targets_calories CHECK (calories > 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_macro_targets_protein') THEN
          ALTER TABLE macro_targets ADD CONSTRAINT chk_macro_targets_protein CHECK (protein >= 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_macro_targets_carbs') THEN
          ALTER TABLE macro_targets ADD CONSTRAINT chk_macro_targets_carbs CHECK (carbs >= 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_macro_targets_fat') THEN
          ALTER TABLE macro_targets ADD CONSTRAINT chk_macro_targets_fat CHECK (fat >= 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_runs_distance') THEN
          ALTER TABLE runs ADD CONSTRAINT chk_runs_distance CHECK (distance_km > 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_runs_duration') THEN
          ALTER TABLE runs ADD CONSTRAINT chk_runs_duration CHECK (duration_seconds > 0);
        END IF;
      END $$;

      -- ========== Sprint 1: New Columns ==========

      -- Routines: is_favorite, category
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routines' AND column_name = 'is_favorite') THEN
          ALTER TABLE routines ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routines' AND column_name = 'category') THEN
          ALTER TABLE routines ADD COLUMN category VARCHAR(50);
        END IF;
      END $$;

      -- Workouts: notes, total_volume_kg
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workouts' AND column_name = 'notes') THEN
          ALTER TABLE workouts ADD COLUMN notes TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workouts' AND column_name = 'total_volume_kg') THEN
          ALTER TABLE workouts ADD COLUMN total_volume_kg REAL;
        END IF;
      END $$;

      -- Runs: elevation_gain_m, avg_heart_rate, max_heart_rate
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'runs' AND column_name = 'elevation_gain_m') THEN
          ALTER TABLE runs ADD COLUMN elevation_gain_m REAL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'runs' AND column_name = 'avg_heart_rate') THEN
          ALTER TABLE runs ADD COLUMN avg_heart_rate INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'runs' AND column_name = 'max_heart_rate') THEN
          ALTER TABLE runs ADD COLUMN max_heart_rate INTEGER;
        END IF;
      END $$;

      -- Food logs: meal_type
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'food_logs' AND column_name = 'meal_type') THEN
          ALTER TABLE food_logs ADD COLUMN meal_type VARCHAR(20);
        END IF;
      END $$;

      -- ========== Social: Follows ==========

      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id),
        CHECK (follower_id != following_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_follows_follower ON follows (follower_id);
      CREATE INDEX IF NOT EXISTS IDX_follows_following ON follows (following_id);

      -- ========== Social: Posts ==========

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id VARCHAR(255) NOT NULL,
        post_type VARCHAR(30) NOT NULL,
        content TEXT,
        reference_id VARCHAR(255),
        reference_data JSONB,
        image_data TEXT,
        visibility VARCHAR(20) DEFAULT 'followers',
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, client_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_posts_user_id ON posts (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS IDX_posts_created ON posts (created_at DESC);

      -- ========== Social: Post Likes ==========

      CREATE TABLE IF NOT EXISTS post_likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_post_likes_post ON post_likes (post_id);
      CREATE INDEX IF NOT EXISTS IDX_post_likes_user ON post_likes (user_id);

      -- ========== Social: Post Comments ==========

      CREATE TABLE IF NOT EXISTS post_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, client_id)
      );
      CREATE INDEX IF NOT EXISTS IDX_post_comments_post ON post_comments (post_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS IDX_post_comments_user ON post_comments (user_id);

      -- ========== Social: User Blocks ==========

      CREATE TABLE IF NOT EXISTS user_blocks (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id),
        CHECK (blocker_id != blocked_id)
      );
      CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks(blocker_id);
      CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON user_blocks(blocked_id);

      -- ========== Social: Content Reports ==========

      CREATE TABLE IF NOT EXISTS content_reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_reports_reporter ON content_reports(reporter_id);

      -- ========== Social: Notifications ==========

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reference_id INTEGER,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

      -- ========== Social: User Profile Extensions ==========

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') THEN
          ALTER TABLE users ADD COLUMN bio TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_public') THEN
          ALTER TABLE users ADD COLUMN is_public BOOLEAN DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url') THEN
          ALTER TABLE users ADD COLUMN avatar_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'followers_count') THEN
          ALTER TABLE users ADD COLUMN followers_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'following_count') THEN
          ALTER TABLE users ADD COLUMN following_count INTEGER DEFAULT 0;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS exercise_gif_cache (
        id SERIAL PRIMARY KEY,
        exercise_name VARCHAR(255) NOT NULL,
        exercise_name_normalized VARCHAR(255) NOT NULL UNIQUE,
        gif_url TEXT,
        body_part VARCHAR(100),
        equipment VARCHAR(100),
        target_muscle VARCHAR(100),
        instructions TEXT,
        gif_data TEXT,
        exercisedb_id VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add columns if they don't exist (for existing installations)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='exercise_gif_cache' AND column_name='gif_data') THEN
          ALTER TABLE exercise_gif_cache ADD COLUMN gif_data TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='exercise_gif_cache' AND column_name='exercisedb_id') THEN
          ALTER TABLE exercise_gif_cache ADD COLUMN exercisedb_id VARCHAR(20);
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
    "SELECT id, email, password_hash, name, age, sex, height_cm, weight_kg, weight_goal_kg, experience, goal, activity_level, created_at FROM users WHERE email = $1",
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
  isFavorite?: boolean;
  category?: string;
}

export async function getRoutines(userId: number): Promise<RoutineData[]> {
  const result = await pool.query(
    `SELECT client_id, name, exercises, created_at, last_completed_at, is_favorite, category
     FROM routines WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(row => ({
    clientId: row.client_id,
    name: row.name,
    exercises: row.exercises,
    createdAt: row.created_at.toISOString(),
    lastCompletedAt: row.last_completed_at?.toISOString(),
    isFavorite: row.is_favorite ?? false,
    category: row.category ?? undefined,
  }));
}

export async function saveRoutine(userId: number, routine: RoutineData): Promise<void> {
  await pool.query(
    `INSERT INTO routines (user_id, client_id, name, exercises, created_at, last_completed_at, is_favorite, category)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       name = EXCLUDED.name,
       exercises = EXCLUDED.exercises,
       last_completed_at = EXCLUDED.last_completed_at,
       is_favorite = EXCLUDED.is_favorite,
       category = EXCLUDED.category`,
    [userId, routine.clientId, routine.name, JSON.stringify(routine.exercises),
     routine.createdAt, routine.lastCompletedAt || null, routine.isFavorite ?? false, routine.category || null]
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
  notes?: string;
  totalVolumeKg?: number;
}

export async function getWorkouts(userId: number): Promise<WorkoutData[]> {
  const result = await pool.query(
    `SELECT client_id, routine_id, routine_name, exercises, started_at, completed_at, duration_minutes, notes, total_volume_kg
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
    notes: row.notes ?? undefined,
    totalVolumeKg: row.total_volume_kg ?? undefined,
  }));
}

export async function saveWorkout(userId: number, workout: WorkoutData): Promise<void> {
  await pool.query(
    `INSERT INTO workouts (user_id, client_id, routine_id, routine_name, exercises, started_at, completed_at, duration_minutes, notes, total_volume_kg)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       routine_id = EXCLUDED.routine_id,
       routine_name = EXCLUDED.routine_name,
       exercises = EXCLUDED.exercises,
       started_at = EXCLUDED.started_at,
       completed_at = EXCLUDED.completed_at,
       duration_minutes = EXCLUDED.duration_minutes,
       notes = EXCLUDED.notes,
       total_volume_kg = EXCLUDED.total_volume_kg`,
    [userId, workout.clientId, workout.routineId, workout.routineName,
     JSON.stringify(workout.exercises), workout.startedAt, workout.completedAt, workout.durationMinutes,
     workout.notes || null, workout.totalVolumeKg || null]
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
  elevationGainM?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
}

export async function getRuns(userId: number): Promise<RunData[]> {
  const result = await pool.query(
    `SELECT client_id, distance_km, duration_seconds, pace_min_per_km, calories, started_at, completed_at, route, elevation_gain_m, avg_heart_rate, max_heart_rate
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
    elevationGainM: row.elevation_gain_m ?? undefined,
    avgHeartRate: row.avg_heart_rate ?? undefined,
    maxHeartRate: row.max_heart_rate ?? undefined,
  }));
}

export async function saveRun(userId: number, run: RunData): Promise<void> {
  await pool.query(
    `INSERT INTO runs (user_id, client_id, distance_km, duration_seconds, pace_min_per_km, calories, started_at, completed_at, route, elevation_gain_m, avg_heart_rate, max_heart_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       distance_km = EXCLUDED.distance_km,
       duration_seconds = EXCLUDED.duration_seconds,
       pace_min_per_km = EXCLUDED.pace_min_per_km,
       calories = EXCLUDED.calories,
       started_at = EXCLUDED.started_at,
       completed_at = EXCLUDED.completed_at,
       route = EXCLUDED.route,
       elevation_gain_m = EXCLUDED.elevation_gain_m,
       avg_heart_rate = EXCLUDED.avg_heart_rate,
       max_heart_rate = EXCLUDED.max_heart_rate`,
    [userId, run.clientId, run.distanceKm, run.durationSeconds, run.paceMinPerKm,
     run.calories, run.startedAt, run.completedAt, run.route ? JSON.stringify(run.route) : null,
     run.elevationGainM || null, run.avgHeartRate || null, run.maxHeartRate || null]
  );
}

export async function deleteRun(userId: number, clientId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM runs WHERE user_id = $1 AND client_id = $2`,
    [userId, clientId]
  );
  return (result.rowCount ?? 0) > 0;
}

// Food Logs
export interface FoodLogData {
  clientId: string;
  foodData: any;
  date: string;
  createdAt: string;
  mealType?: string;
}

export async function getFoodLogs(userId: number, date?: string): Promise<FoodLogData[]> {
  let query = `SELECT client_id, food_data, date, created_at, image_data, meal_type FROM food_logs WHERE user_id = $1`;
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
    mealType: row.meal_type ?? undefined,
    ...(row.image_data ? { imageUri: row.image_data } : {}),
  }));
}

export async function saveFoodLog(userId: number, log: FoodLogData & { imageUri?: string }): Promise<void> {
  await pool.query(
    `INSERT INTO food_logs (user_id, client_id, food_data, date, created_at, image_data, meal_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       food_data = EXCLUDED.food_data,
       date = EXCLUDED.date,
       image_data = COALESCE(EXCLUDED.image_data, food_logs.image_data),
       meal_type = EXCLUDED.meal_type`,
    [userId, log.clientId, JSON.stringify(log.foodData), log.date, log.createdAt, log.imageUri || null, log.mealType || null]
  );
}

export async function updateFoodLog(userId: number, clientId: string, foodData: any): Promise<boolean> {
  const result = await pool.query(
    "UPDATE food_logs SET food_data = $3 WHERE user_id = $1 AND client_id = $2 RETURNING id",
    [userId, clientId, JSON.stringify(foodData)]
  );
  return result.rowCount !== null && result.rowCount > 0;
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
    "UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
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

// ========== Social: Follows ==========

export async function followUser(followerId: number, followingId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [followerId, followingId]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("UPDATE users SET following_count = following_count + 1 WHERE id = $1", [followerId]);
    await client.query("UPDATE users SET followers_count = followers_count + 1 WHERE id = $1", [followingId]);
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

export async function unfollowUser(followerId: number, followingId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 RETURNING id",
      [followerId, followingId]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = $1", [followerId]);
    await client.query("UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = $1", [followingId]);
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

export async function isFollowing(followerId: number, followingId: number): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2",
    [followerId, followingId]
  );
  return result.rows.length > 0;
}

export interface FollowUserRow {
  userId: number;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  isFollowedByMe: boolean;
}

export async function getFollowers(userId: number, requestingUserId: number, page: number, limit: number): Promise<FollowUserRow[]> {
  const offset = page * limit;
  const result = await pool.query(
    `SELECT u.id AS user_id, u.name, u.avatar_url, u.bio,
       EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = $3 AND f2.following_id = u.id) AS is_followed_by_me
     FROM follows f
     JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = $1
       AND u.id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = $3)
       AND u.id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = $3)
     ORDER BY f.created_at DESC
     LIMIT $2 OFFSET $4`,
    [userId, limit, requestingUserId, offset]
  );
  return result.rows.map(row => ({
    userId: row.user_id,
    name: row.name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    isFollowedByMe: row.is_followed_by_me,
  }));
}

export async function getFollowing(userId: number, requestingUserId: number, page: number, limit: number): Promise<FollowUserRow[]> {
  const offset = page * limit;
  const result = await pool.query(
    `SELECT u.id AS user_id, u.name, u.avatar_url, u.bio,
       EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id = $3 AND f2.following_id = u.id) AS is_followed_by_me
     FROM follows f
     JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = $1
       AND u.id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = $3)
       AND u.id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = $3)
     ORDER BY f.created_at DESC
     LIMIT $2 OFFSET $4`,
    [userId, limit, requestingUserId, offset]
  );
  return result.rows.map(row => ({
    userId: row.user_id,
    name: row.name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    isFollowedByMe: row.is_followed_by_me,
  }));
}

// ========== Social: Posts ==========

export interface PostRow {
  id: number;
  userId: number;
  clientId: string;
  postType: string;
  content: string | null;
  referenceId: string | null;
  referenceData: any;
  imageData: string | null;
  visibility: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  likedByMe: boolean;
}

export async function createPost(userId: number, post: {
  clientId: string;
  postType: string;
  content?: string;
  referenceId?: string;
  referenceData?: any;
  imageData?: string;
  visibility?: string;
}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO posts (user_id, client_id, post_type, content, reference_id, reference_data, image_data, visibility)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       content = EXCLUDED.content,
       reference_data = EXCLUDED.reference_data,
       image_data = EXCLUDED.image_data
     RETURNING id`,
    [userId, post.clientId, post.postType, post.content || null,
     post.referenceId || null, post.referenceData ? JSON.stringify(post.referenceData) : null,
     post.imageData || null, post.visibility || "followers"]
  );
  return result.rows[0].id;
}

function mapPostRow(row: any): PostRow {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    postType: row.post_type,
    content: row.content,
    referenceId: row.reference_id,
    referenceData: row.reference_data,
    imageData: row.image_data,
    visibility: row.visibility,
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url,
    likedByMe: row.liked_by_me ?? false,
  };
}

export async function getPost(postId: number, requestingUserId: number): Promise<PostRow | null> {
  const result = await pool.query(
    `SELECT p.*, u.name AS author_name, u.avatar_url AS author_avatar_url,
       EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $2) AS liked_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1`,
    [postId, requestingUserId]
  );
  if (result.rows.length === 0) return null;
  return mapPostRow(result.rows[0]);
}

export async function deletePost(userId: number, postId: number): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id",
    [postId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getFeedPosts(userId: number, cursor?: string, limit = 20): Promise<{ posts: PostRow[]; nextCursor?: string }> {
  const params: any[] = [userId, limit + 1];
  let cursorClause = "";
  if (cursor) {
    cursorClause = "AND p.created_at < $3";
    params.push(cursor);
  }

  const result = await pool.query(
    `SELECT p.*, u.name AS author_name, u.avatar_url AS author_avatar_url,
       EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS liked_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE (p.user_id = $1
       OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
       OR p.visibility = 'public')
       AND p.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = $1)
       AND p.user_id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = $1)
       ${cursorClause}
     ORDER BY p.created_at DESC
     LIMIT $2`,
    params
  );

  const rows = result.rows.map(mapPostRow);
  let nextCursor: string | undefined;
  if (rows.length > limit) {
    rows.pop();
    nextCursor = rows[rows.length - 1].createdAt;
  }
  return { posts: rows, nextCursor };
}

export async function getUserPosts(targetUserId: number, requestingUserId: number, cursor?: string, limit = 20): Promise<{ posts: PostRow[]; nextCursor?: string }> {
  const params: any[] = [targetUserId, requestingUserId, limit + 1];
  let cursorClause = "";
  if (cursor) {
    cursorClause = "AND p.created_at < $4";
    params.push(cursor);
  }

  const result = await pool.query(
    `SELECT p.*, u.name AS author_name, u.avatar_url AS author_avatar_url,
       EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $2) AS liked_by_me
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1
       AND (p.user_id = $2 OR p.visibility = 'public'
         OR $2 IN (SELECT follower_id FROM follows WHERE following_id = p.user_id))
       ${cursorClause}
     ORDER BY p.created_at DESC
     LIMIT $3`,
    params
  );

  const rows = result.rows.map(mapPostRow);
  let nextCursor: string | undefined;
  if (rows.length > limit) {
    rows.pop();
    nextCursor = rows[rows.length - 1].createdAt;
  }
  return { posts: rows, nextCursor };
}

// ========== Social: Likes ==========

export async function likePost(userId: number, postId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [postId, userId]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1", [postId]);
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

export async function unlikePost(userId: number, postId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2 RETURNING id",
      [postId, userId]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query("UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1", [postId]);
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

// ========== Social: Comments ==========

export interface PostCommentRow {
  id: number;
  postId: number;
  userId: number;
  clientId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

export async function getPostComments(postId: number, requestingUserId: number, page: number, limit: number): Promise<PostCommentRow[]> {
  const offset = page * limit;
  const result = await pool.query(
    `SELECT pc.id, pc.post_id, pc.user_id, pc.client_id, pc.content, pc.created_at,
       u.name AS author_name, u.avatar_url AS author_avatar_url
     FROM post_comments pc
     JOIN users u ON u.id = pc.user_id
     WHERE pc.post_id = $1
       AND pc.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = $4)
       AND pc.user_id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = $4)
     ORDER BY pc.created_at ASC
     LIMIT $2 OFFSET $3`,
    [postId, limit, offset, requestingUserId]
  );
  return result.rows.map(row => ({
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    clientId: row.client_id,
    content: row.content,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url,
  }));
}

export async function addComment(userId: number, postId: number, clientId: string, content: string): Promise<PostCommentRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO post_comments (post_id, user_id, client_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, post_id, user_id, client_id, content, created_at`,
      [postId, userId, clientId, content]
    );
    await client.query("UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1", [postId]);
    await client.query("COMMIT");

    const row = result.rows[0];
    const user = await getUserById(userId);
    return {
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      clientId: row.client_id,
      content: row.content,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      authorName: user?.name || "Unknown",
      authorAvatarUrl: null,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteComment(userId: number, commentId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "DELETE FROM post_comments WHERE id = $1 AND user_id = $2 RETURNING post_id",
      [commentId, userId]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    const postId = result.rows[0].post_id;
    await client.query("UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1", [postId]);
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

// ========== Social: User Discovery & Profile ==========

export async function searchUsers(query: string, requestingUserId: number, limit = 20): Promise<FollowUserRow[]> {
  const result = await pool.query(
    `SELECT u.id AS user_id, u.name, u.avatar_url, u.bio,
       EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.following_id = u.id) AS is_followed_by_me
     FROM users u
     WHERE u.is_public = TRUE AND u.id != $2
       AND u.name ILIKE $1
       AND u.id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = $2)
       AND u.id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = $2)
     ORDER BY u.name ASC
     LIMIT $3`,
    [`%${query}%`, requestingUserId, limit]
  );
  return result.rows.map(row => ({
    userId: row.user_id,
    name: row.name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    isFollowedByMe: row.is_followed_by_me,
  }));
}

export interface SocialProfileRow {
  userId: number;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  followersCount: number;
  followingCount: number;
  isFollowedByMe: boolean;
  isBlockedByMe: boolean;
  totalWorkouts: number;
  totalRuns: number;
  totalDistanceKm: number;
  currentStreak: number;
  memberSince: string;
}

export async function getSocialProfile(targetUserId: number, requestingUserId: number): Promise<SocialProfileRow | null> {
  const result = await pool.query(
    `SELECT u.id AS user_id, u.name, u.bio, u.avatar_url, u.is_public,
       u.followers_count, u.following_count, u.current_streak, u.created_at,
       EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.following_id = u.id) AS is_followed_by_me,
       EXISTS(SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = $2 AND ub.blocked_id = u.id) AS is_blocked_by_me,
       (SELECT COUNT(*)::int FROM workouts w WHERE w.user_id = u.id) AS total_workouts,
       (SELECT COUNT(*)::int FROM runs r WHERE r.user_id = u.id) AS total_runs,
       (SELECT COALESCE(SUM(r.distance_km), 0)::real FROM runs r WHERE r.user_id = u.id) AS total_distance_km
     FROM users u
     WHERE u.id = $1`,
    [targetUserId, requestingUserId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    userId: row.user_id,
    name: row.name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    isPublic: row.is_public ?? true,
    followersCount: row.followers_count || 0,
    followingCount: row.following_count || 0,
    isFollowedByMe: row.is_followed_by_me,
    isBlockedByMe: row.is_blocked_by_me,
    totalWorkouts: row.total_workouts,
    totalRuns: row.total_runs,
    totalDistanceKm: row.total_distance_km,
    currentStreak: row.current_streak || 0,
    memberSince: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

export async function updateSocialProfile(userId: number, data: { bio?: string; avatarUrl?: string; isPublic?: boolean }): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.bio !== undefined) {
    fields.push(`bio = $${paramIndex++}`);
    values.push(data.bio);
  }
  if (data.avatarUrl !== undefined) {
    fields.push(`avatar_url = $${paramIndex++}`);
    values.push(data.avatarUrl);
  }
  if (data.isPublic !== undefined) {
    fields.push(`is_public = $${paramIndex++}`);
    values.push(data.isPublic);
  }

  if (fields.length === 0) return;

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(userId);

  await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
    values
  );
}

// ========== Social: Blocking ==========

export async function blockUser(blockerId: number, blockedId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [blockerId, blockedId]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    // Auto-unfollow both directions
    const unfollowed1 = await client.query(
      "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 RETURNING id",
      [blockerId, blockedId]
    );
    if ((unfollowed1.rowCount ?? 0) > 0) {
      await client.query("UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = $1", [blockerId]);
      await client.query("UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = $1", [blockedId]);
    }
    const unfollowed2 = await client.query(
      "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 RETURNING id",
      [blockedId, blockerId]
    );
    if ((unfollowed2.rowCount ?? 0) > 0) {
      await client.query("UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = $1", [blockedId]);
      await client.query("UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = $1", [blockerId]);
    }
    await client.query("COMMIT");
    return true;
  } catch {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

export async function unblockUser(blockerId: number, blockedId: number): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2 RETURNING id",
    [blockerId, blockedId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getBlockedUsers(userId: number): Promise<{ userId: number; name: string; avatarUrl: string | null; blockedAt: string }[]> {
  const result = await pool.query(
    `SELECT u.id AS user_id, u.name, u.avatar_url, b.created_at AS blocked_at
     FROM user_blocks b
     JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return result.rows.map(row => ({
    userId: row.user_id,
    name: row.name,
    avatarUrl: row.avatar_url,
    blockedAt: row.blocked_at,
  }));
}

export async function isBlocked(userId1: number, userId2: number): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)",
    [userId1, userId2]
  );
  return result.rows.length > 0;
}

// ========== Social: Reports ==========

export async function reportContent(reporterId: number, reportType: string, targetId: number, reason: string, details?: string): Promise<number> {
  const result = await pool.query(
    `INSERT INTO content_reports (reporter_id, report_type, target_id, reason, details)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [reporterId, reportType, targetId, reason, details || null]
  );
  return result.rows[0].id;
}

// ========== Social: Notifications ==========

export interface NotificationRow {
  id: number;
  userId: number;
  type: string;
  actorId: number;
  actorName: string;
  actorAvatarUrl: string | null;
  referenceId: number | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export async function createNotification(userId: number, type: string, actorId: number, referenceId: number | null, message: string): Promise<void> {
  if (userId === actorId) return; // don't notify self
  // Don't notify if blocked
  const blocked = await isBlocked(userId, actorId);
  if (blocked) return;
  await pool.query(
    `INSERT INTO notifications (user_id, type, actor_id, reference_id, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, actorId, referenceId, message]
  );
}

export async function getNotifications(userId: number, page: number, limit = 20): Promise<NotificationRow[]> {
  const offset = page * limit;
  const result = await pool.query(
    `SELECT n.id, n.user_id, n.type, n.actor_id, n.reference_id, n.message, n.is_read, n.created_at,
       u.name AS actor_name, u.avatar_url AS actor_avatar_url
     FROM notifications n
     JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorAvatarUrl: row.actor_avatar_url,
    referenceId: row.reference_id,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }));
}

export async function markNotificationsRead(userId: number): Promise<void> {
  await pool.query(
    "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
    [userId]
  );
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
    [userId]
  );
  return result.rows[0].count;
}

// ========== Social: Post & Comment Editing ==========

export async function updatePost(postId: number, userId: number, content: string): Promise<boolean> {
  const result = await pool.query(
    "UPDATE posts SET content = $1 WHERE id = $2 AND user_id = $3 RETURNING id",
    [content, postId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateComment(commentId: number, userId: number, content: string): Promise<boolean> {
  const result = await pool.query(
    "UPDATE post_comments SET content = $1 WHERE id = $2 AND user_id = $3 RETURNING id",
    [content, commentId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ========== Exercise GIF Cache ==========

export interface ExerciseGifCache {
  exerciseName: string;
  gifUrl: string | null;
  bodyPart: string | null;
  equipment: string | null;
  targetMuscle: string | null;
  instructions: string | null;
  gifData?: string | null;
  exerciseDbId?: string | null;
}

export async function getExerciseGifCache(exerciseName: string): Promise<ExerciseGifCache | null> {
  const normalized = exerciseName.toLowerCase().trim();
  const result = await pool.query(
    `SELECT exercise_name, gif_url, body_part, equipment, target_muscle, instructions, gif_data, exercisedb_id
     FROM exercise_gif_cache WHERE exercise_name_normalized = $1`,
    [normalized]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    exerciseName: row.exercise_name,
    gifUrl: row.gif_url,
    bodyPart: row.body_part,
    equipment: row.equipment,
    targetMuscle: row.target_muscle,
    instructions: row.instructions,
    gifData: row.gif_data,
    exerciseDbId: row.exercisedb_id,
  };
}

export async function saveExerciseGifCache(data: ExerciseGifCache): Promise<void> {
  const normalized = data.exerciseName.toLowerCase().trim();
  await pool.query(
    `INSERT INTO exercise_gif_cache (exercise_name, exercise_name_normalized, gif_url, body_part, equipment, target_muscle, instructions, gif_data, exercisedb_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (exercise_name_normalized) DO UPDATE SET
       gif_url = EXCLUDED.gif_url,
       body_part = EXCLUDED.body_part,
       equipment = EXCLUDED.equipment,
       target_muscle = EXCLUDED.target_muscle,
       instructions = EXCLUDED.instructions,
       gif_data = EXCLUDED.gif_data,
       exercisedb_id = EXCLUDED.exercisedb_id`,
    [data.exerciseName, normalized, data.gifUrl, data.bodyPart, data.equipment, data.targetMuscle, data.instructions, data.gifData || null, data.exerciseDbId || null]
  );
}

export async function bulkSaveExerciseMetadata(exercises: Array<{
  exerciseName: string;
  bodyPart: string | null;
  equipment: string | null;
  targetMuscle: string | null;
  instructions: string | null;
  exerciseDbId: string;
}>): Promise<{ inserted: number; updated: number; failed: number }> {
  const client = await pool.connect();
  const results = { inserted: 0, updated: 0, failed: 0 };

  try {
    await client.query("BEGIN");

    for (const ex of exercises) {
      const normalized = ex.exerciseName.toLowerCase().trim();
      try {
        await client.query(
          `INSERT INTO exercise_gif_cache
             (exercise_name, exercise_name_normalized, body_part, equipment, target_muscle, instructions, exercisedb_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (exercise_name_normalized) DO UPDATE SET
             body_part = EXCLUDED.body_part,
             equipment = EXCLUDED.equipment,
             target_muscle = EXCLUDED.target_muscle,
             instructions = EXCLUDED.instructions,
             exercisedb_id = EXCLUDED.exercisedb_id,
             gif_url = CASE
               WHEN exercise_gif_cache.gif_data IS NOT NULL
               THEN '/api/exercises/image/' || EXCLUDED.exercisedb_id
               ELSE exercise_gif_cache.gif_url
             END`,
          [ex.exerciseName, normalized, ex.bodyPart, ex.equipment, ex.targetMuscle, ex.instructions, ex.exerciseDbId]
        );
        results.inserted++;
      } catch (err) {
        results.failed++;
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return results;
}

export async function getExerciseGifDataById(exerciseDbId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT gif_data FROM exercise_gif_cache WHERE exercisedb_id = $1 AND gif_data IS NOT NULL`,
    [exerciseDbId]
  );
  return result.rows[0]?.gif_data || null;
}

export async function fuzzySearchExerciseGifCache(searchTerm: string): Promise<ExerciseGifCache | null> {
  const normalized = searchTerm.toLowerCase().trim();
  // Normalize hyphens to spaces for flexible matching
  const withSpaces = normalized.replace(/-/g, " ");
  // Search for entries that have gif_data and match via substring (with hyphen normalization)
  const result = await pool.query(
    `SELECT exercise_name, gif_url, body_part, equipment, target_muscle, instructions, gif_data, exercisedb_id
     FROM exercise_gif_cache
     WHERE gif_data IS NOT NULL
       AND (
         REPLACE(exercise_name_normalized, '-', ' ') LIKE '%' || $1 || '%'
         OR $1 LIKE '%' || REPLACE(exercise_name_normalized, '-', ' ') || '%'
       )
     ORDER BY LENGTH(exercise_name_normalized) ASC
     LIMIT 1`,
    [withSpaces]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    exerciseName: row.exercise_name,
    gifUrl: row.gif_url,
    bodyPart: row.body_part,
    equipment: row.equipment,
    targetMuscle: row.target_muscle,
    instructions: row.instructions,
    gifData: row.gif_data,
    exerciseDbId: row.exercisedb_id,
  };
}
