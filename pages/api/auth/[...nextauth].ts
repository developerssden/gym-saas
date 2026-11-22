/* eslint-disable @typescript-eslint/no-explicit-any */
import { verifyPassword } from '@/lib/authHelper';
import prisma from '@/lib/prisma';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { atob } from 'buffer';
import { NextApiRequest, NextApiResponse } from 'next';
import { NextApiHandler } from 'next';
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

/**
 * Gyms a user can select: an owner's own gyms, or a staff member's one
 * assigned gym (and only while their owner still owns it).
 */
async function selectableGymsWhere(userId: string, role: string) {
  if (role === 'STAFF') {
    const staff = await prisma.user.findUnique({
      where: { id: userId },
      select: { staff_owner_id: true, staff_gym_id: true },
    });
    return {
      id: staff?.staff_gym_id ?? '__none__',
      owner_id: staff?.staff_owner_id ?? '__none__',
      is_deleted: false,
      is_active: true,
    };
  }
  return { owner_id: userId, is_deleted: false, is_active: true };
}

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
          const { email, password, remember } = req.body as {
            email: string;
            password: string;
            remember?: string | boolean;
          };

          const dbUser: any = await prisma.user.findFirst({
            where: {
              email,
              is_deleted: false,
              is_active: true
            },
            // password is omitted globally (lib/prisma.ts); sign-in needs it to verify.
            omit: { password: false },
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
            last_name: dbUser.last_name,
            remember: remember === true || remember === 'true'
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
    maxAge: 30 * 24 * 60 * 60, // 30 days (capped to 24h in jwt when remember is false)
    updateAge: 30 * 60 // 30 minutes (you can keep or adjust this)
  },
  debug: process.env.NODE_ENV !== 'production',
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    jwt: async ({ token, user, profile, trigger, session }) => {
      // If user is signing in for the first time, add role to token
      if (user) {
        token.role = user.role;
        token.first_name = user.first_name;
        token.last_name = user.last_name;
        token.remember = user.remember === true;
        
        // For GYM_OWNER and STAFF, set default gym and location on first login
        if (user.role === 'GYM_OWNER' || user.role === 'STAFF') {
          const gyms = await prisma.gym.findMany({
            where: await selectableGymsWhere(user.id, user.role),
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
      } else if ((token.role === 'GYM_OWNER' || token.role === 'STAFF') && !token.selected_gym_id && token.sub) {
        // If token doesn't have selected_gym_id (e.g., after refresh), set defaults
        const gyms = await prisma.gym.findMany({
          where: await selectableGymsWhere(token.sub, token.role),
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

      // Handle session updates. Role is never taken from the client: a
      // session update must not be able to promote a staff login.
      if (trigger === 'update' && session) {
        token.first_name = session.user.first_name;
        token.last_name = session.user.last_name;
        if (session.user.selected_location_id !== undefined) {
          token.selected_location_id = session.user.selected_location_id;
        }
        if (session.user.selected_gym_id !== undefined) {
          token.selected_gym_id = session.user.selected_gym_id;
        }
      }

      // Staff permissions live in the token so proxy.ts can gate pages.
      // Re-read them whenever the token is refreshed, so an owner's changes
      // (or deactivation) reach the staff member's next page load.
      if (token.role === 'STAFF' && token.sub) {
        const staff = await prisma.user.findFirst({
          where: { id: token.sub, role: 'STAFF', is_active: true, is_deleted: false },
          select: { staff_permissions: true, staff_gym_id: true },
        });
        token.staff_permissions = staff?.staff_permissions ?? [];
        // A staff member may only ever have their assigned gym selected.
        if (staff?.staff_gym_id && token.selected_gym_id !== staff.staff_gym_id) {
          token.selected_gym_id = staff.staff_gym_id;
          token.selected_location_id = null;
        }
      }

      const issuedAt =
        typeof token.iat === 'number'
          ? token.iat
          : Math.floor(Date.now() / 1000);
      const maxAge = token.remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
      token.exp = issuedAt + maxAge;

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
        
        // Staff work on their owner's data: the owner's plan and subscription
        // apply, and they only see their assigned gym.
        let businessOwnerId: string | null = null;
        if (userData.role === 'GYM_OWNER') {
          businessOwnerId = userData.id;
        } else if (userData.role === 'STAFF') {
          const owner = userData.staff_owner_id
            ? await prisma.user.findFirst({
                where: { id: userData.staff_owner_id, role: 'GYM_OWNER', is_active: true, is_deleted: false },
                select: { id: true },
              })
            : null;
          businessOwnerId = owner?.id ?? null;
          session.user.staff_owner_id = businessOwnerId;
          session.user.staff_gym_id = userData.staff_gym_id;
          session.user.staff_permissions = businessOwnerId ? userData.staff_permissions : [];
        }

        // For GYM_OWNER and STAFF, fetch gyms and locations
        if (businessOwnerId) {
          const gymsWhere = await selectableGymsWhere(userData.id, userData.role);
          const gyms = await prisma.gym.findMany({
            where: gymsWhere,
            orderBy: {
              createdAt: 'asc'
            }
          });

          const locations = await prisma.location.findMany({
            where: {
              gym: gymsWhere,
              is_deleted: false,
              is_active: true
            },
            orderBy: {
              createdAt: 'asc'
            }
          });
          
          session.user.gyms = gyms.map(gym => ({
            id: gym.id,
            name: gym.name,
            country: gym.country,
          }));
          
          session.user.locations = locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            gymId: loc.gym_id,
            address: loc.address,
            country: loc.country,
          }));

          // Add subscription status (the owner's, for staff too)
          const activeSubscription = await prisma.ownerSubscription.findFirst({
            where: {
              owner_id: businessOwnerId,
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
            session.user.subscription_end_date = activeSubscription.end_date.toISOString();
            session.user.subscription_limits = {
              max_gyms: activeSubscription.plan.max_gyms,
              max_locations: activeSubscription.plan.max_locations,
              max_members: activeSubscription.plan.max_members,
              max_equipment: activeSubscription.plan.max_equipment,
              max_staff: activeSubscription.plan.max_staff
            };
          } else {
            session.user.subscription_active = false;
            session.user.subscription_expired = true;
            session.user.subscription_end_date = null;
            session.user.subscription_limits = {
              max_gyms: 0,
              max_locations: 0,
              max_members: 0,
              max_equipment: 0,
              max_staff: 0
            };
          }
        }
      }

      return session;
    }
  }
};