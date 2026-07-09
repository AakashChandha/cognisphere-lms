import { Router } from 'express';
import { getCourses } from '../controllers/courseController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/courses', asyncHandler(getCourses));

export default router;
