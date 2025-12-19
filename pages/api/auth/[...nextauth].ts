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
        
        // For GYM_OWNER, set default gym and location on first login
        if (user.role === 'GYM_OWNER') {
          const gyms = await prisma.gym.findMany({
            where: {
              owner_id: user.id,
              is_deleted: false,
              is_active: true
            },
            orderBy: {
              createdAt: 'asc'
            },
            include: {
              locations: {
                where: {
                  is_deleted: false,
                  is_active: true
                },
                orderBy: {
                  createdAt: 'asc'
                }
              }
            }
          });
          
          if (gyms.length > 0) {
            const firstGym = gyms[0];
            token.selected_gym_id = firstGym.id;
            
            if (firstGym.locations.length > 0) {
              token.selected_location_id = firstGym.locations[0].id;
            } else {
              token.selected_location_id = null;
            }
          }
        }
      } else if (token.role === 'GYM_OWNER' && !token.selected_gym_id && token.sub) {
        // If token doesn't have selected_gym_id (e.g., after refresh), set defaults
        const gyms = await prisma.gym.findMany({
          where: {
            owner_id: token.sub,
            is_deleted: false,
            is_active: true
          },
          orderBy: {
            createdAt: 'asc'
          },
          include: {
            locations: {
              where: {
                is_deleted: false,
                is_active: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          }
        });
        
        if (gyms.length > 0) {
          const firstGym = gyms[0];
          token.selected_gym_id = firstGym.id;
          
          if (firstGym.locations.length > 0) {
            token.selected_location_id = firstGym.locations[0].id;
          } else {
            token.selected_location_id = null;
          }
        }
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        token.role = session.user.role;
        token.first_name = session.user.first_name;
        token.last_name = session.user.last_name;
        if (session.user.selected_location_id !== undefined) {
          token.selected_location_id = session.user.selected_location_id;
        }
        if (session.user.selected_gym_id !== undefined) {
          token.selected_gym_id = session.user.selected_gym_id;
        }
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
        session.user.email = userData.email;
        session.user.first_name = userData.first_name;
        session.user.last_name = userData.last_name;
        session.user.phone_number = userData.phone_number;
        session.user.address = userData.address;
        session.user.city = userData.city;
        session.user.state = userData.state;
        session.user.zip_code = userData.zip_code;
        session.user.country = userData.country;
        session.user.date_of_birth = userData.date_of_birth;
        session.user.cnic = userData.cnic;
        session.user.profile_picture = userData.profile_picture;
        session.user.selected_location_id = token.selected_location_id;
        session.user.selected_gym_id = token.selected_gym_id;
        
        // Get plan from active owner subscription
        const activeSubscription = userData.ownerSubscriptions?.[0];
        if (activeSubscription?.plan) {
          session.user.max_gyms = activeSubscription.plan.max_gyms;
          session.user.max_members = activeSubscription.plan.max_members;
          session.user.max_equipment = activeSubscription.plan.max_equipment;
        }
        
        // For GYM_OWNER, fetch gyms and locations
        if (userData.role === 'GYM_OWNER') {
          const gyms = await prisma.gym.findMany({
            where: {
              owner_id: userData.id,
              is_deleted: false,
              is_active: true
            },
            orderBy: {
              createdAt: 'asc'
            }
          });
          
          const locations = await prisma.location.findMany({
            where: {
              gym: {
                owner_id: userData.id,
                is_deleted: false,
                is_active: true
              },
              is_deleted: false,
              is_active: true
            },
            orderBy: {
              createdAt: 'asc'
            }
          });
          
          session.user.gyms = gyms.map(gym => ({
            id: gym.id,
            name: gym.name
          }));
          
          session.user.locations = locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            gymId: loc.gym_id,
            address: loc.address
          }));

          // Add subscription status for GYM_OWNER
          const activeSubscription = await prisma.ownerSubscription.findFirst({
            where: {
              owner_id: userData.id,
              is_deleted: false,
              is_active: true,
              is_expired: false
            },
            orderBy: {
              createdAt: 'desc'
            },
            include: {
              plan: true
            }
          });

          if (activeSubscription?.plan) {
            session.user.subscription_active = true;
            session.user.subscription_expired = false;
            session.user.subscription_limits = {
              max_gyms: activeSubscription.plan.max_gyms,
              max_locations: activeSubscription.plan.max_locations,
              max_members: activeSubscription.plan.max_members,
              max_equipment: activeSubscription.plan.max_equipment
            };
          } else {
            session.user.subscription_active = false;
            session.user.subscription_expired = true;
            session.user.subscription_limits = {
              max_gyms: 0,
              max_locations: 0,
              max_members: 0,
              max_equipment: 0
            };
          }
        }
      }

      return session;
    }
  }
};