import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sitesRouter from "./sites";
import heartbeatRouter from "./heartbeat";
import searchRouter from "./search";
import mapRouter from "./map";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sitesRouter);
router.use(heartbeatRouter);
router.use(searchRouter);
router.use(mapRouter);

export default router;
