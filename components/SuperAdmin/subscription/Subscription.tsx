import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Session } from "next-auth";
import Link from "next/link";

const Subscription = ({ session }: { session: Session }) => {
  return (
    <PageContainer>
      <div className="flex justify-between items-center">
        <h1 className="h1">Subscriptions</h1>
        <Link href={`/subscriptions/manage?action=create`}>
          <Button>Create Subscription</Button>
        </Link>
      </div>
    </PageContainer>
  );
};

export default Subscription;
