import { query } from '../models/db.js';

export const getHealthStatus = async () => {
  const databaseResult = await query('SELECT NOW() AS checked_at');

  return {
    status: 'ok',
    service: 'lms-backend',
    database: {
      status: 'connected',
      checkedAt: databaseResult.rows[0].checked_at,
    },
  };
};
