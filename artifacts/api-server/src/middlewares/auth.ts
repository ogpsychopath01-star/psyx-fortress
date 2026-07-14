import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET || "psyx-secret-fallback";

export interface AuthRequest extends Request {
  user?: typeof usersTable.$inferSelect;
  userId?: number;
}

export interface JwtPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

export function authMiddleware(required = true) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      if (required) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      return next();
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, payload.userId),
      });

      if (!user) {
        if (required) {
          res.status(401).json({ error: "User not found" });
          return;
        }
        return next();
      }

      if (user.status === "banned" || user.status === "suspended") {
        res.status(403).json({ error: `Account is ${user.status}` });
        return;
      }

      req.user = user;
      req.userId = user.id;
      next();
    } catch {
      if (required) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      next();
    }
  };
}

export function requireRole(...roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function generateToken(userId: number, rememberMe = false): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: rememberMe ? "30d" : "7d",
  });
}

/** Verify a JWT and return the payload or null if invalid */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
