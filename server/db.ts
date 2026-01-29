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
        experience VARCHAR(50),
        goal VARCHAR(50),
        activity_level VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        PRIMARY KEY (sid)
      );

      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
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
    "SELECT id, email, name, age, sex, height_cm, weight_kg, experience, goal, activity_level, created_at FROM users WHERE id = $1",
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
     RETURNING id, email, name, age, sex, height_cm, weight_kg, experience, goal, activity_level`,
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
