import type { NextApiRequest, NextApiResponse } from "next";

/** For container health checks. Deliberately does not touch the database or the browser. */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ status: "ok" });
}
