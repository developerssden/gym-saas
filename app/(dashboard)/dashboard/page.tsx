'use client';

import AdminDashboard from '@/components/dashboard/AdminDashboard';
import OwnerDashboard from '@/components/dashboard/OwnerDashboard';
import FullScreenLoader from '@/components/common/FullScreenLoader';
import { useSession } from 'next-auth/react';

const DashboardPage = () => {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <FullScreenLoader />;
  }

  const role = session?.user?.role;

  return (
    <div>
      {role === "SUPER_ADMIN" ? <AdminDashboard /> : <OwnerDashboard />}
    </div>
  );
}

export default DashboardPage;
