import { Router } from 'express';
import authRoutes from './authRoutes.js';
import courseRoutes from './courseRoutes.js';
import healthRoutes from './healthRoutes.js';
import studentRoutes from './studentRoutes.js';

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(courseRoutes);
router.use(studentRoutes);

export default router;
