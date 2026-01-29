import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getUserByEmail, getUserById, createUser, updateUserProfile } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const router = Router();

// Simple in-memory token store (in production, use Redis or database)
const tokenStore = new Map<string, { userId: number; expires: number }>();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function storeToken(userId: number): string {
  const token = generateToken();
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  tokenStore.set(token, { userId, expires });
  return token;
}

function getUserIdFromToken(token: string): number | null {
  const data = tokenStore.get(token);
  if (!data) return null;
  if (Date.now() > data.expires) {
    tokenStore.delete(token);
    return null;
  }
  return data.userId;
}

function removeToken(token: string): void {
  tokenStore.delete(token);
}

// Get user ID from session or Bearer token
function getUserIdFromRequest(req: Request): number | null {
  // First check session
  if (req.session.userId) {
    return req.session.userId;
  }
  // Then check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return getUserIdFromToken(token);
  }
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  // Store userId on request for later use
  (req as any).userId = userId;
  next();
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, passwordHash, name });

    req.session.userId = user.id;
    const token = storeToken(user.id);

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      token, // Return token for mobile clients
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Failed to register" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    req.session.userId = user.id;
    const token = storeToken(user.id);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      age: user.age,
      sex: user.sex,
      heightCm: user.height_cm,
      weightKg: user.weight_kg,
      experience: user.experience,
      goal: user.goal,
      activityLevel: user.activity_level,
      token, // Return token for mobile clients
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
  const userId = getUserIdFromRequest(req);
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
    const { name, age, sex, heightCm, weightKg, experience, goal, activityLevel } = req.body;
    const userId = (req as any).userId;

    const updated = await updateUserProfile(userId, {
      name,
      age,
      sex,
      heightCm,
      weightKg,
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
      experience: updated.experience,
      goal: updated.goal,
      activityLevel: updated.activity_level,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
