import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  Megaphone,
  UserCircle,
  ScrollText,
  Shield,
  ClipboardList,
  Library,
  MessagesSquare,
} from "lucide-react";
import { AppRole } from "@/types/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: Record<AppRole, NavItem[]> = {
  [AppRole.MASTER]: [
    { label: "Dashboard", href: "/master/dashboard", icon: LayoutDashboard },
    { label: "Users", href: "/master/users", icon: Users },
    { label: "Tutors", href: "/master/tutors", icon: GraduationCap },
    { label: "Students", href: "/master/students", icon: UserCircle },
    { label: "Courses", href: "/master/courses", icon: BookOpen },
    { label: "Assessments", href: "/master/assessments", icon: ClipboardList },
    { label: "Materials", href: "/master/materials", icon: Library },
    { label: "Queries", href: "/master/queries", icon: MessagesSquare },
    { label: "Announcements", href: "/master/announcements", icon: Megaphone },
    { label: "Audit Logs", href: "/master/audit-logs", icon: ScrollText },
    { label: "Profile", href: "/master/profile", icon: Shield },
  ],
  [AppRole.TUTOR]: [
    { label: "Dashboard", href: "/tutor/dashboard", icon: LayoutDashboard },
    { label: "Courses", href: "/tutor/courses", icon: BookOpen },
    { label: "Assessments", href: "/tutor/assessments", icon: ClipboardList },
    { label: "Students", href: "/tutor/students", icon: Users },
    { label: "Materials", href: "/tutor/materials", icon: Library },
    { label: "Queries", href: "/tutor/queries", icon: MessagesSquare },
    { label: "Announcements", href: "/tutor/announcements", icon: Megaphone },
    { label: "Profile", href: "/tutor/profile", icon: UserCircle },
  ],
  [AppRole.STUDENT]: [
    { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { label: "My Courses", href: "/student/courses", icon: BookOpen },
    { label: "Materials", href: "/student/materials", icon: Library },
    { label: "Queries", href: "/student/queries", icon: MessagesSquare },
    { label: "Announcements", href: "/student/announcements", icon: Megaphone },
    { label: "Profile", href: "/student/profile", icon: UserCircle },
  ],
};
