import { getHealthStatus } from '../services/healthService.js';

export const healthCheck = async (req, res) => {
  const health = await getHealthStatus();
  res.status(200).json(health);
};
