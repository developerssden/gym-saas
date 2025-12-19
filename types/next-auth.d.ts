import 'next-auth';
import 'next-auth/jwt';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      phone_number: string;
      address: string;
      city: string;
      state: string;
      zip_code: string;
      country: string;
      date_of_birth: Date;
      cnic: string | null;
      profile_picture: string | null;
      role: string;
      createdAt: Date;
      updatedAt: Date;
      selected_location_id?: string | null;
      selected_gym_id?: string | null;
      max_gyms?: number | null;
      max_members?: number | null;
      max_equipment?: number | null;
      subscription_active?: boolean;
      subscription_expired?: boolean;
      subscription_limits?: {
        max_gyms: number;
        max_locations: number;
        max_members: number;
        max_equipment: number;
      };
      gyms?: Array<{
        id: string;
        name: string;
      }>;
      locations?: Array<{
        id: string;
        name: string;
        gymId: string;
        address?: string | null;
      }>;
    };
  }

  interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
    date_of_birth: Date;
    cnic: string | null;
    profile_picture: string | null;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
    date_of_birth: Date;
    cnic: string | null;
    profile_picture: string | null;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    selected_location_id?: string | null;
    selected_gym_id?: string | null;
  }
}