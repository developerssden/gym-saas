"use client"
import FullScreenLoader from "@/components/common/FullScreenLoader"
import Clients from "@/components/SuperAdmin/client/Clients"
import { redirect } from "next/navigation"
import { useSession } from "next-auth/react"

const ClientsPage = () => {
    const { data: session, status } = useSession({ required: true })
    if (status === "loading") {
        return <FullScreenLoader />
    }
    if (session?.user?.role !== "SUPER_ADMIN") {
        return redirect("/unauthorized")
    }
    return <Clients session={session} />
}

export default ClientsPage