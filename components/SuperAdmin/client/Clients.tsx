import { PageContainer } from "@/components/layout/page-container";
import { Session } from "next-auth";

const Clients = ({ session }: { session: Session }) => {
  return <PageContainer>Clients</PageContainer>;
};

export default Clients;
