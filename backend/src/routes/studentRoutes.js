import { Router } from 'express';
import { getStudents } from '../controllers/studentController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/students', asyncHandler(getStudents));

export default router;
