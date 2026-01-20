// src/types/next-auth.d.ts
import 'next-auth';
import { UserRoleType, TeamTypeType } from '../db/schema';

declare module 'next-auth' {
  interface User {
    id: string;
    name: string;
    email: string; // ← this is the username
    role: UserRoleType;
    team_type: TeamTypeType;
    team_leader_id: string | null;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string; // ← username
      role: UserRoleType;
      team_type: TeamTypeType;
      team_leader_id: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    name: string;
    email: string; // ← username
    role: UserRoleType;
    team_type: TeamTypeType;
    team_leader_id: string | null;
  }
}