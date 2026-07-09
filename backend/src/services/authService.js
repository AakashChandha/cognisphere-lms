import crypto from 'crypto';
import { query } from '../models/db.js';
import { config } from '../config/env.js';

export const login = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `SELECT id, name, email, role
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );

  if (result.rowCount === 0) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  // Dummy login for local scaffolding. Replace with hashed password checks before real users.
  const token = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${result.rows[0].id}:${Date.now()}`)
    .digest('hex');

  return {
    user: result.rows[0],
    token,
  };
};
