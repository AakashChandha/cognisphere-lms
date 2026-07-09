import * as authService from '../services/authService.js';

export const login = async (req, res) => {
  const session = await authService.login(req.body);
  res.status(200).json(session);
};
