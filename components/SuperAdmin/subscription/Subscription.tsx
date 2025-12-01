import { PageContainer } from "@/components/layout/page-container";
import { Session } from "next-auth";

const Subscription = ({ session }: { session: Session }) => {
  return (
    <PageContainer>
      <div>
        <h1 className="h1">Subscriptions</h1>
      </div>
    </PageContainer>
  );
};

export default Subscription;
