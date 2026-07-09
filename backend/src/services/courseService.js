import { query } from '../models/db.js';

export const listCourses = async () => {
  const result = await query(
    `SELECT id, title, description, created_at
     FROM courses
     ORDER BY created_at DESC`,
  );

  return result.rows;
};
