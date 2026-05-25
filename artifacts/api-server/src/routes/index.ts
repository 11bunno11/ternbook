import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sitesRouter from "./sites";
import heartbeatRouter from "./heartbeat";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sitesRouter);
router.use(heartbeatRouter);
router.use(searchRouter);

export default router;
