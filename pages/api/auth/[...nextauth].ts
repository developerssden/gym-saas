/* eslint-disable @typescript-eslint/no-explicit-any */
import { verifyPassword } from '@/lib/authHelper';
import prisma from '@/lib/prisma';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { atob } from 'buffer';
import { NextApiRequest, NextApiResponse } from 'next';
import { NextApiHandler } from 'next';
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const authHandler: NextApiHandler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  return NextAuth(req, res, options);
};
export default authHandler;
export const options: NextAuthOptions = {
  pages: {
    signIn: '/sign-in',
    signOut: '/sign-in',
    error: '/sign-in'
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'jsmith' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        try {
          const { email, password } = req.body as {
            email: string;
            password: string;
          };

          const dbUser: any = await prisma.user.findFirst({
            where: {
              email,
              is_deleted: false,
              is_active: true
            }
          });
          if (!dbUser) {
            throw new Error('no_user_found');
          }
          if (!dbUser.password) {
            throw new Error('incorrect_password');
          }
          const passwordMatch = await verifyPassword(password, dbUser.password);
          if (!passwordMatch) {
            throw new Error('incorrect_password');
          }
          const user = {
            ...dbUser,
            name: dbUser.first_name + ' ' + dbUser.last_name,
            id: dbUser.id,
            role: dbUser.role,
            first_name: dbUser.first_name,
            last_name: dbUser.last_name
          };
          return user;
        } catch (error) {
          throw error;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 30 * 60 // 30 minutes (you can keep or adjust this)
  },
  debug: process.env.ENV !== 'PROD',
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    jwt: async ({ token, user, profile, trigger, session }) => {
      // If user is signing in for the first time, add role to token
      if (user) {
        token.role = user.role;
        token.first_name = user.first_name;
        token.last_name = user.last_name;
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        token.role = session.user.role;
        token.first_name = session.user.first_name;
        token.last_name = session.user.last_name;
        token.selected_location_id = session.user.selected_location_id;
      }

      return token;
    },
    session: async ({ session, token }: any) => {
      const userData = await prisma.user.findUnique({
        where: {
          id: token.sub,
          is_deleted: false,
          is_active: true
        },
        include: {
          ownerSubscriptions: {
            where: {
              is_deleted: false,
              is_active: true,
            },
            include: {
              plan: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        }
      });
      // Add role and other user data to session
      if (userData) {
        session.user.id = userData.id;
        session.user.role = userData.role;
        session.user.first_name = userData.first_name;
        session.user.last_name = userData.last_name;
        session.user.selected_location_id = token.selected_location_id;
        
        // Get plan from active owner subscription
        const activeSubscription = userData.ownerSubscriptions?.[0];
        if (activeSubscription?.plan) {
          session.user.max_gyms = activeSubscription.plan.max_gyms;
          session.user.max_members = activeSubscription.plan.max_members;
          session.user.max_equipment = activeSubscription.plan.max_equipment;
        }
      }

      return session;
    }
  }
};