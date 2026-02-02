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
