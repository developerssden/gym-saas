"use client"

import { useState } from "react"
import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { get, set, del } from "idb-keyval"
import type { Persister } from "@tanstack/query-persist-client-core"

function createIDBPersister(idbKey = "gymsaas-query-cache"): Persister {
  return {
    persistClient: async (client) => {
      await set(idbKey, client)
    },
    restoreClient: async () => await get(idbKey),
    removeClient: async () => await del(idbKey),
  }
}

const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 24 * 60 * 60 * 1000,
          },
        },
      })
  )
  const [persister] = useState(() => createIDBPersister())

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}

export default QueryProvider
