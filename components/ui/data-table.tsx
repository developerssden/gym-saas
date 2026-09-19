"use client"

import {
    ColumnDef,
    SortingState,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"

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

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    searchableColumns?: string[]
    isSearching?: boolean
    emptyAction?: React.ReactNode
    searchLabel?: string
    searchPlaceholder?: string
    emptyMessage?: string
    emptyDescription?: string
    searchEmptyMessage?: string
    searchEmptyDescription?: string
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
    searchEmptyDescription,
}: DataTableProps<TData, TValue> & {
    pageCount?: number
    rowCount?: number
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
    onSearchChange?: (value: string) => void
    pagination?: { pageIndex: number; pageSize: number }
    searchValue?: string
}) {

    const [sorting, setSorting] = React.useState<SortingState>([])
    const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("")

    // Use controlled or uncontrolled state
    const globalFilter = searchValue !== undefined ? searchValue : internalGlobalFilter
    const setGlobalFilter = onSearchChange ? onSearchChange : setInternalGlobalFilter

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

    return (
        <div className="flex flex-col gap-4">
            {searchableColumns.length > 0 && (
                <div className="flex items-center justify-between">
                    <div className="flex flex-1 items-center gap-2">
                        <label htmlFor="data-table-search" className="sr-only">
                            {searchLabel}
                        </label>
                        <Input
                            id="data-table-search"
                            type="search"
                            aria-label={searchLabel}
                            placeholder={searchPlaceholder}
                            value={globalFilter}
                            onChange={(event) => setGlobalFilter(event.target.value)}
                            className="h-10 w-full max-w-sm border-border bg-background shadow-none"
                        />
                    </div>
                </div>
            )}
            <div className="flex max-h-[calc(100svh-280px)] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground md:max-h-[calc(100vh-280px)]">
                <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
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
                        <TableBody>
                            {filteredRows?.length ? (
                                filteredRows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 px-4">
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {isSearching
                                                        ? searchEmptyMessage
                                                        : emptyMessage}
                                                </p>
                                                {(isSearching
                                                    ? searchEmptyDescription
                                                    : emptyDescription) && (
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {isSearching
                                                            ? searchEmptyDescription
                                                            : emptyDescription}
                                                    </p>
                                                )}
                                            </div>
                                            {!isSearching && emptyAction}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="shrink-0 border-t border-border">
                    <DataTablePagination table={table} />
                </div>
            </div>
        </div>
    )
}