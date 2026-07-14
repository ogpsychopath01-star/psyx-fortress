import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import emailsRouter from "./emails";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";
import ownerRouter from "./owner";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);
router.use(emailsRouter);
router.use(notificationsRouter);
router.use(adminRouter);
router.use(ownerRouter);

export default router;
