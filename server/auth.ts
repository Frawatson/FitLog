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

// JWT and session secrets must be distinct so a leak of one (or rotation of
// one) does not invalidate the other. Both are required at startup.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
if (JWT_SECRET === process.env.SESSION_SECRET) {
  throw new Error("JWT_SECRET and SESSION_SECRET must be different values");
}
const JWT_ALGORITHM = "HS256" as const;
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

// Track failed login attempts. If the previous attempt is older than the
// lockout window, restart the counter at 1 so users aren't permanently
// stranded at MAX_FAILED_ATTEMPTS after one bad attempt long ago.
async function recordFailedAttempt(email: string): Promise<void> {
  try {
    await pool.query(`
      INSERT INTO login_attempts (email, attempt_count, last_attempt_at)
      VALUES ($1, 1, NOW())
      ON CONFLICT (email) DO UPDATE SET
        attempt_count = CASE
          WHEN login_attempts.last_attempt_at < NOW() - ($2 || ' minutes')::interval
            THEN 1
          ELSE login_attempts.attempt_count + 1
        END,
        last_attempt_at = NOW()
    `, [email.toLowerCase(), String(LOCKOUT_DURATION_MINUTES)]);
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
  return jwt.sign({ userId }, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN,
  });
}

function decodeToken(token: string): { userId: number; iat: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as { userId: number; iat: number };
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

// Registration uses an email-confirmation flow so /register cannot be used
// to enumerate which addresses already have accounts: the endpoint always
// responds the same way, and the differentiation happens only inside the
// email we send (confirmation link vs. "someone tried to register").

const REGISTER_CONFIRM_TOKEN_TYPE = "register-confirm";
const REGISTER_CONFIRM_EXPIRES_IN = "24h";

interface RegisterConfirmPayload {
  type: typeof REGISTER_CONFIRM_TOKEN_TYPE;
  email: string;
  passwordHash: string;
  name: string;
}

function signRegisterConfirmToken(payload: Omit<RegisterConfirmPayload, "type">): string {
  return jwt.sign(
    { type: REGISTER_CONFIRM_TOKEN_TYPE, ...payload },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: REGISTER_CONFIRM_EXPIRES_IN },
  );
}

function verifyRegisterConfirmToken(token: string): RegisterConfirmPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as RegisterConfirmPayload;
    if (decoded.type !== REGISTER_CONFIRM_TOKEN_TYPE) return null;
    if (typeof decoded.email !== "string" || typeof decoded.passwordHash !== "string" || typeof decoded.name !== "string") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function registerConfirmUrl(token: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  // EXPO_PUBLIC_DOMAIN may be a bare host or a full URL; normalize to https.
  const base = domain
    ? (domain.startsWith("http") ? domain : `https://${domain}`)
    : "http://localhost:5000";
  return `${base.replace(/\/$/, "")}/api/auth/register/confirm?token=${encodeURIComponent(token)}`;
}

async function sendRegisterConfirmEmail(email: string, name: string, token: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const url = registerConfirmUrl(token);
  if (!resendApiKey) {
    console.log(`[DEV] Registration confirmation for ${email}: ${url}`);
    return;
  }
  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "Merge <support@mergefitness.fitness>",
      to: [email.toLowerCase()],
      subject: "Confirm your Merge account",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1A1A1A; font-size: 20px;">Confirm your account</h2>
          <p style="color: #333; line-height: 1.6;">Hi ${escapeHtml(name)}, tap the button below to finish creating your Merge account. The link expires in 24 hours.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${url}" style="background: #FF4500; color: #FFFFFF; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; display: inline-block;">Confirm Account</a>
          </div>
          <p style="color: #666; font-size: 14px;">If you didn't try to create a Merge account, you can ignore this email — no account will be created.</p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error("Failed to send registration confirmation email:", emailError);
  }
}

async function sendRegisterAttemptEmail(email: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.log(`[DEV] Registration attempt notice for existing user ${email}`);
    return;
  }
  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "Merge <support@mergefitness.fitness>",
      to: [email.toLowerCase()],
      subject: "Someone tried to register with your email",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1A1A1A; font-size: 20px;">Account already exists</h2>
          <p style="color: #333; line-height: 1.6;">Someone just tried to create a Merge account using this email address, but you already have one.</p>
          <p style="color: #333; line-height: 1.6;">If this was you, open the Merge app and sign in. If you've forgotten your password, use the "Forgot password" link on the sign-in screen.</p>
          <p style="color: #666; font-size: 14px;">If it wasn't you, no action is needed — your account is unchanged.</p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error("Failed to send registration attempt email:", emailError);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderConfirmationPage(opts: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(opts.title)}</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F7F7F7; color: #1A1A1A; }
      .card { max-width: 480px; margin: 64px auto; padding: 32px; background: #FFFFFF; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); text-align: center; }
      h1 { font-size: 22px; margin: 0 0 16px; }
      p { line-height: 1.6; color: #333; margin: 0 0 16px; }
      a.button { display: inline-block; margin-top: 16px; background: #FF4500; color: #FFFFFF; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapeHtml(opts.title)}</h1>
      ${opts.body}
    </div>
  </body>
</html>`;
}

const GENERIC_REGISTER_RESPONSE = {
  success: true,
  confirmationRequired: true,
  message: "If the email is valid, a confirmation link has been sent. Check your inbox to finish creating your account.",
} as const;

router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }
    if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
      return res.status(400).json({ error: "Invalid input" });
    }

    // Validate email format and length (RFC 5321 caps at 254).
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    const normalizedName = name.trim().slice(0, 255);
    if (normalizedName.length === 0) {
      return res.status(400).json({ error: "Name is required" });
    }
    const normalizedEmail = email.toLowerCase();

    // Always hash the password before the existence check so the request
    // takes a roughly constant amount of CPU regardless of whether the email
    // is new (closes a timing side-channel for enumeration).
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      // Fire-and-forget so response timing doesn't leak whether we sent
      // "you already have an account" vs. "confirm your registration".
      sendRegisterAttemptEmail(normalizedEmail).catch(() => {});
    } else {
      const confirmToken = signRegisterConfirmToken({
        email: normalizedEmail,
        passwordHash,
        name: normalizedName,
      });
      sendRegisterConfirmEmail(normalizedEmail, normalizedName, confirmToken).catch(() => {});
    }

    return res.status(202).json(GENERIC_REGISTER_RESPONSE);
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Failed to register" });
  }
});

const registerConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many confirmation attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/register/confirm", registerConfirmLimiter, async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const payload = token ? verifyRegisterConfirmToken(token) : null;

  if (!payload) {
    return res.status(400).type("html").send(
      renderConfirmationPage({
        title: "Link expired",
        body: `<p>This confirmation link is invalid or has expired. Open the Merge app and tap <strong>Create Account</strong> again to receive a new link.</p>`,
      }),
    );
  }

  try {
    const existing = await getUserByEmail(payload.email);
    if (!existing) {
      try {
        await createUser({
          email: payload.email,
          passwordHash: payload.passwordHash,
          name: payload.name,
        });
      } catch (createError: any) {
        // 23505 = unique_violation. Treat as "another request just created
        // this account" — confirmation is idempotent from the user's POV.
        if (createError?.code !== "23505") throw createError;
      }
    }

    return res.type("html").send(
      renderConfirmationPage({
        title: "Account confirmed",
        body: `<p>Your Merge account is ready. Open the app and sign in with your email and password to continue.</p>
               <a class="button" href="merge://login">Open Merge</a>`,
      }),
    );
  } catch (error) {
    console.error("Registration confirmation error:", error);
    return res.status(500).type("html").send(
      renderConfirmationPage({
        title: "Something went wrong",
        body: `<p>We couldn't confirm your account right now. Please try the link again in a few minutes, or contact support if the problem continues.</p>`,
      }),
    );
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

    await pool.query(
      "DELETE FROM session WHERE (sess::jsonb)->>'userId' = $1",
      [String(verification.userId)],
    );

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
