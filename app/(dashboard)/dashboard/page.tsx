'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import OwnerDashboard from '@/components/dashboard/OwnerDashboard';
import FullScreenLoader from '@/components/common/FullScreenLoader';

const DashboardPage = () => {
  const { data: session, status } = useSession({ required: true });

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  const role = session?.user?.role;

  if (role === 'SUPER_ADMIN') {
    return <AdminDashboard />;
  }

  if (role === 'GYM_OWNER') {
    return <OwnerDashboard />;
  }

  redirect('/unauthorized');
};

export default DashboardPage;
