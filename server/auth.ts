import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { getUserByEmail, getUserById, createUser, updateUserProfile, deleteUser, pool, createPasswordResetCode, verifyPasswordResetCode, markResetCodeUsed, updateUserPassword } from "./db";
import { Resend } from "resend";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const router = Router();

// JWT secret from environment (required)
const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
const JWT_EXPIRES_IN = "30d"; // 30 days

// Rate limiter for auth routes (5 attempts per 15 minutes)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: "Too many attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password strength validation
function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character" };
  }
  return { valid: true, message: "" };
}

// Account lockout constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// Track failed login attempts
async function recordFailedAttempt(email: string): Promise<void> {
  try {
    await pool.query(`
      INSERT INTO login_attempts (email, attempt_count, last_attempt_at)
      VALUES ($1, 1, NOW())
      ON CONFLICT (email) DO UPDATE SET
        attempt_count = login_attempts.attempt_count + 1,
        last_attempt_at = NOW()
    `, [email.toLowerCase()]);
  } catch (error) {
    console.error("Error recording failed attempt:", error);
  }
}

// Clear failed attempts on successful login
async function clearFailedAttempts(email: string): Promise<void> {
  try {
    await pool.query("DELETE FROM login_attempts WHERE email = $1", [email.toLowerCase()]);
  } catch (error) {
    console.error("Error clearing failed attempts:", error);
  }
}

// Check if account is locked
async function isAccountLocked(email: string): Promise<{ locked: boolean; remainingMinutes: number }> {
  try {
    const result = await pool.query(`
      SELECT attempt_count, last_attempt_at 
      FROM login_attempts 
      WHERE email = $1
    `, [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return { locked: false, remainingMinutes: 0 };
    }
    
    const { attempt_count, last_attempt_at } = result.rows[0];
    const lockoutEnd = new Date(last_attempt_at);
    lockoutEnd.setMinutes(lockoutEnd.getMinutes() + LOCKOUT_DURATION_MINUTES);
    
    if (attempt_count >= MAX_FAILED_ATTEMPTS && new Date() < lockoutEnd) {
      const remainingMinutes = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
      return { locked: true, remainingMinutes };
    }
    
    // If lockout period has passed, clear the attempts
    if (attempt_count >= MAX_FAILED_ATTEMPTS && new Date() >= lockoutEnd) {
      await clearFailedAttempts(email);
    }
    
    return { locked: false, remainingMinutes: 0 };
  } catch (error) {
    console.error("Error checking account lock:", error);
    return { locked: false, remainingMinutes: 0 };
  }
}

function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function decodeToken(token: string): { userId: number; iat: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; iat: number };
    return decoded;
  } catch (error) {
    return null;
  }
}

async function getUserIdFromToken(token: string): Promise<number | null> {
  const decoded = decodeToken(token);
  if (!decoded) return null;

  const result = await pool.query(
    "SELECT password_changed_at FROM users WHERE id = $1",
    [decoded.userId]
  );
  if (result.rows.length === 0) return null;

  const { password_changed_at } = result.rows[0];
  if (password_changed_at) {
    const changedAtSeconds = Math.floor(new Date(password_changed_at).getTime() / 1000);
    if (decoded.iat < changedAtSeconds) {
      return null;
    }
  }

  return decoded.userId;
}

async function getUserIdFromRequest(req: Request): Promise<number | null> {
  if (req.session.userId) {
    return req.session.userId;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return getUserIdFromToken(token);
  }
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  getUserIdFromRequest(req).then(userId => {
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    (req as any).userId = userId;
    next();
  }).catch(() => {
    res.status(401).json({ error: "Authentication required" });
  });
}

router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12); // Increased from 10 to 12 rounds
    const user = await createUser({ email, passwordHash, name });

    req.session.userId = user.id;
    const token = generateToken(user.id);

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      token, // Return JWT token for mobile clients
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Failed to register" });
  }
});

router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if account is locked
    const lockStatus = await isAccountLocked(email);
    if (lockStatus.locked) {
      return res.status(429).json({ 
        error: `Account temporarily locked. Please try again in ${lockStatus.remainingMinutes} minutes.` 
      });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      await recordFailedAttempt(email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordFailedAttempt(email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Clear failed attempts on successful login
    await clearFailedAttempts(email);

    req.session.userId = user.id;
    const token = generateToken(user.id);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      age: user.age,
      sex: user.sex,
      heightCm: user.height_cm,
      weightKg: user.weight_kg,
      weightGoalKg: user.weight_goal_kg,
      experience: user.experience,
      goal: user.goal,
      activityLevel: user.activity_level,
      token, // Return JWT token for mobile clients
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

router.get("/me", async (req: Request, res: Response) => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      age: user.age,
      sex: user.sex,
      heightCm: user.height_cm,
      weightKg: user.weight_kg,
      weightGoalKg: user.weight_goal_kg,
      experience: user.experience,
      goal: user.goal,
      activityLevel: user.activity_level,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.put("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, age, sex, heightCm, weightKg, weightGoalKg, experience, goal, activityLevel } = req.body;
    const userId = (req as any).userId;

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0 || name.length > 255)) {
      return res.status(400).json({ error: "Name must be between 1 and 255 characters" });
    }
    if (age !== undefined && (typeof age !== "number" || age < 13 || age > 120)) {
      return res.status(400).json({ error: "Age must be between 13 and 120" });
    }
    if (sex !== undefined && !["male", "female", "other"].includes(sex)) {
      return res.status(400).json({ error: "Invalid sex value" });
    }
    if (heightCm !== undefined && (typeof heightCm !== "number" || heightCm < 50 || heightCm > 300)) {
      return res.status(400).json({ error: "Height must be between 50 and 300 cm" });
    }
    if (weightKg !== undefined && (typeof weightKg !== "number" || weightKg < 20 || weightKg > 500)) {
      return res.status(400).json({ error: "Weight must be between 20 and 500 kg" });
    }
    if (weightGoalKg !== undefined && (typeof weightGoalKg !== "number" || weightGoalKg < 20 || weightGoalKg > 500)) {
      return res.status(400).json({ error: "Weight goal must be between 20 and 500 kg" });
    }

    const updated = await updateUserProfile(userId, {
      name: name?.trim(),
      age,
      sex,
      heightCm,
      weightKg,
      weightGoalKg,
      experience,
      goal,
      activityLevel,
    });

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      age: updated.age,
      sex: updated.sex,
      heightCm: updated.height_cm,
      weightKg: updated.weight_kg,
      weightGoalKg: updated.weight_goal_kg,
      experience: updated.experience,
      goal: updated.goal,
      activityLevel: updated.activity_level,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: "Too many reset attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/forgot-password", resetLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.json({ success: true, message: "If an account exists with that email, a reset code has been sent." });
    }

    const code = await createPasswordResetCode(user.id);

    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: "Merge <support@mergefitness.fitness>",
          to: [email.toLowerCase()],
          subject: "Your Merge Password Reset Code",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #1A1A1A; font-size: 20px;">Password Reset</h2>
              <p style="color: #333; line-height: 1.6;">You requested a password reset. Enter this code in the app:</p>
              <div style="background: #F5F5F5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #FF4500;">${code}</span>
              </div>
              <p style="color: #666; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send reset email:", emailError);
      }
    } else {
      console.log(`[DEV] Password reset code for ${email}: ${code}`);
    }

    res.json({ success: true, message: "If an account exists with that email, a reset code has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process reset request" });
  }
});

router.post("/reset-password", resetLimiter, async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, code, and new password are required" });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    const verification = await verifyPasswordResetCode(email, code);
    if (!verification.valid || !verification.userId) {
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await updateUserPassword(verification.userId, passwordHash);
    await markResetCodeUsed(email, code);
    await clearFailedAttempts(email);

    await pool.query("DELETE FROM session WHERE sess::text LIKE $1", [`%"userId":${verification.userId}%`]);

    res.json({ success: true, message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.delete("/account", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    const deleted = await deleteUser(userId);
    
    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }
    
    req.session.destroy(() => {});
    res.clearCookie("connect.sid");
    
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
