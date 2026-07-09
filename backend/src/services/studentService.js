import { query } from '../models/db.js';

export const listStudents = async () => {
  const result = await query(
    `SELECT
       users.id,
       users.name,
       users.email,
       COUNT(enrollments.id)::int AS enrolled_courses
     FROM users
     LEFT JOIN enrollments ON enrollments.user_id = users.id
     WHERE users.role = 'student'
     GROUP BY users.id
     ORDER BY users.name ASC`,
  );

  return result.rows;
};
