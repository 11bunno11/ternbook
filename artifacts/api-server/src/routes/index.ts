import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sitesRouter from "./sites";
import heartbeatRouter from "./heartbeat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sitesRouter);
router.use(heartbeatRouter);

export default router;
