// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { UserRoleType, TeamTypeType } from '@/db/schema';

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) {
          return null;
        }

        // Find user by "username" (stored in `email` column)
        const user = await db
          .select()
          .from(users)
          .where(eq(users.username, credentials.username)) // ← email = username
          .limit(1);

        if (user.length === 0) {
          return null;
        }

        const dbUser = user[0];

        // Check if active
        if (!dbUser.is_active) {
          return null;
        }

        // Compare password
        const isValid = await compare(credentials.password, dbUser.password);
        if (!isValid) {
          return null;
        }

        // Return user object (must match NextAuth.User type)
        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.username, // ← this is the username
          role: dbUser.role as UserRoleType,
          team_type: dbUser.team_type as TeamTypeType,
          team_leader_id: dbUser.team_leader_id ?? null,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.team_type = user.team_type;
        token.team_leader_id = user.team_leader_id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRoleType;
        session.user.team_type = token.team_type as TeamTypeType;
        session.user.team_leader_id = token.team_leader_id as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };