import * as bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS } from '../constants/app.constants';

export async function hashValue(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

export async function compareValue(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
