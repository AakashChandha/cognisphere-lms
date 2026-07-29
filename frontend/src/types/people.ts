import type { AppRole } from "./auth";

export interface Student {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  enrolledCoursesCount: number;
  createdAt: string;
}

export interface Tutor {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  expertise: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  coursesCount: number;
  createdAt: string;
}

export interface ManagedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  roles: AppRole[];
  createdAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: AppRole[];
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  roles?: AppRole[];
  isActive?: boolean;
}

export interface QueryUserParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: AppRole;
}

export interface Role {
  id: string;
  name: AppRole;
  description: string | null;
  createdAt: string;
}

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roles: AppRole[];
  phone?: string | null;
  bio?: string | null;
  expertise?: string | null;
  createdAt: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  expertise?: string;
  avatarUrl?: string;
}
