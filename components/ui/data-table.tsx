"use client"

import {
    ColumnDef,
    Row,
    SortingState,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { useRouter } from "next/navigation"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { DataTablePagination } from "./data-table-pagination"
import React from "react"
import { Input } from "./input"
import { Skeleton } from "./skeleton"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    searchableColumns?: string[]
    /** True while a search term is applied: switches the empty state to "no results". */
    isSearching?: boolean
    emptyAction?: React.ReactNode
    searchLabel?: string
    searchPlaceholder?: string
    emptyMessage?: string
    emptyDescription?: string
    searchEmptyMessage?: string
    searchEmptyDescription?: string
    /**
     * Phone layout (under md): one card per row, usually a `ListCard`. Without
     * it the table is shown at every width.
     */
    mobileCard?: (row: TData) => React.ReactNode
    /** Whole row opens this page (desktop rows; give the ListCard the same href). */
    getRowHref?: (row: TData) => string | undefined
    /** Shows skeleton rows instead of the list (first load). */
    isLoading?: boolean
}

export function DataTable<TData, TValue>({
    columns,
    data,
    searchableColumns = [],
    pageCount,
    onPaginationChange,
    onSearchChange,
    pagination,
    searchValue,
    isSearching = false,
    emptyAction,
    searchLabel = "Search",
    searchPlaceholder = "Search",
    emptyMessage = "No results.",
    emptyDescription,
    searchEmptyMessage = "No results match your search.",
    searchEmptyDescription = "Check the spelling or try a shorter search.",
    mobileCard,
    getRowHref,
    isLoading = false,
}: DataTableProps<TData, TValue> & {
    pageCount?: number
    rowCount?: number
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
    onSearchChange?: (value: string) => void
    pagination?: { pageIndex: number; pageSize: number }
    searchValue?: string
}) {
    const router = useRouter()
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("")

    // Use controlled or uncontrolled state
    const globalFilter = searchValue !== undefined ? searchValue : internalGlobalFilter
    const setGlobalFilter = onSearchChange ? onSearchChange : setInternalGlobalFilter
    // A typed search term means an empty list is "no results", not "nothing yet".
    const searching = isSearching || !!globalFilter.trim()

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        pageCount: pageCount,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        manualPagination: !!pageCount,
        manualFiltering: !!onSearchChange,
        onPaginationChange: (updater) => {
            if (typeof updater === "function") {
                const newPagination = updater(table.getState().pagination)
                onPaginationChange?.(newPagination)
            } else {
                onPaginationChange?.(updater)
            }
        },
        state: {
            sorting,
            pagination,
            globalFilter,
        },
    })

    // Filter rows based on global filter - ONLY for client-side mode
    const filteredRows = React.useMemo(() => {
        if (!!onSearchChange) {
            // Server-side filtering, data is already filtered
            return table.getRowModel().rows
        }

        if (!globalFilter || searchableColumns.length === 0) {
            return table.getRowModel().rows
        }

        return table.getRowModel().rows.filter((row) => {
            return searchableColumns.some((columnId) => {
                const value = row.getValue(columnId)
                return value
                    ?.toString()
                    .toLowerCase()
                    .includes(globalFilter.toLowerCase())
            })
        })
    }, [table, globalFilter, searchableColumns, onSearchChange])

    const openRow = (row: Row<TData>, event: React.MouseEvent | React.KeyboardEvent) => {
        const href = getRowHref?.(row.original)
        if (!href) return
        // Ignore clicks on buttons, links and inputs inside the row.
        if ((event.target as HTMLElement).closest("a, button, input, select, textarea, [role=menuitem]")) return
        if ("key" in event && event.key !== "Enter") return
        if ("metaKey" in event && (event.metaKey || event.ctrlKey)) window.open(href, "_blank")
        else router.push(href)
    }

    const emptyState = (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <div>
                <p className="font-medium text-foreground">{searching ? searchEmptyMessage : emptyMessage}</p>
                {(searching ? searchEmptyDescription : emptyDescription) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {searching ? searchEmptyDescription : emptyDescription}
                    </p>
                )}
            </div>
            {!searching && emptyAction}
        </div>
    )

    const skeletonRows = Array.from({ length: Math.min(pagination?.pageSize ?? 5, 6) }, (_, i) => i)

    return (
        <div className="flex flex-col gap-4">
            {searchableColumns.length > 0 && (
                <div className="flex items-center">
                    <label htmlFor="data-table-search" className="sr-only">
                        {searchLabel}
                    </label>
                    <Input
                        id="data-table-search"
                        type="search"
                        placeholder={searchPlaceholder}
                        value={globalFilter}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="h-11 w-full border-border bg-background shadow-none md:h-10 md:max-w-sm"
                    />
                </div>
            )}
            <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
                {mobileCard && (
                    <div className="md:hidden">
                        {isLoading ? (
                            <ul aria-busy="true" aria-label="Loading">
                                {skeletonRows.map((i) => (
                                    <li key={i} className="flex items-center gap-3 border-b border-border p-4 last:border-b-0">
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-2/3" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                        <Skeleton className="h-5 w-16" />
                                    </li>
                                ))}
                            </ul>
                        ) : filteredRows.length ? (
                            <ul>
                                {filteredRows.map((row) => (
                                    <React.Fragment key={row.id}>{mobileCard(row.original)}</React.Fragment>
                                ))}
                            </ul>
                        ) : (
                            emptyState
                        )}
                    </div>
                )}
                <div className={cn("overflow-x-auto", mobileCard && "hidden md:block")}>
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody aria-busy={isLoading || undefined}>
                            {isLoading ? (
                                skeletonRows.map((i) => (
                                    <TableRow key={i}>
                                        {columns.map((_, c) => (
                                            <TableCell key={c}>
                                                <Skeleton className="h-4 w-full max-w-32" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filteredRows?.length ? (
                                filteredRows.map((row) => {
                                    const href = getRowHref?.(row.original)
                                    return (
                                        <TableRow
                                            key={row.id}
                                            data-state={row.getIsSelected() && "selected"}
                                            className={cn(href && "cursor-pointer")}
                                            onClick={href ? (e) => openRow(row, e) : undefined}
                                            onKeyDown={href ? (e) => openRow(row, e) : undefined}
                                            tabIndex={href ? 0 : undefined}
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-48">
                                        {emptyState}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="border-t border-border">
                    <DataTablePagination table={table} />
                </div>
            </div>
        </div>
    )
}
