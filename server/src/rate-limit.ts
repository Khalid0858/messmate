import type { Request, Response, NextFunction } from "express";
import { RateBucket } from "./models.ts";
import { digest } from "./security.ts";
// Shared counters survive Vercel instance changes. Store hashes, never raw IPs.
export function persistentLimit(name: string, windowMs: number, limit: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const window = Math.floor(Date.now() / windowMs),
      expiresAt = new Date((window + 1) * windowMs),
      key = `${name}:${window}:${digest(req.ip || "unknown")}`;
    const update = () =>
      RateBucket.findOneAndUpdate(
        { key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, new: true },
      );
    let row;
    try {
      row = await update();
    } catch (e: any) {
      if (e.code !== 11000) throw e;
      row = await update();
    }
    if (row.count > limit) {
      res.setHeader(
        "Retry-After",
        String(Math.ceil((expiresAt.getTime() - Date.now()) / 1000)),
      );
      res
        .status(429)
        .json({ error: "Too many requests. Please try again later." });
      return;
    }
    next();
  };
}
