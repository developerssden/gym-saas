import { AuthProvider } from "./AuthProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>{children}</AuthProvider>
    )
}