import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/sites", async (_req, res) => {
  const sites = await db.select().from(sitesTable);
  res.json(sites);
});

export default router;
