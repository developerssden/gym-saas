'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';

export default function UnauthorizedPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isMember = session?.user?.role === 'MEMBER';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <ShieldX className="h-12 w-12 text-muted-foreground" />

      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isMember ? 'Member portal coming soon' : 'Access denied'}
        </h1>
        <p className="text-muted-foreground max-w-sm">
          {isMember
            ? 'This app is currently for gym owners. A member portal is on the way. Contact your gym for membership information.'
            : 'You do not have permission to access this page.'}
        </p>
      </div>

      <Button variant="outline" onClick={() => router.push('/sign-in')}>
        Back to sign in
      </Button>
    </div>
  );
}
