import { Table } from "@tanstack/react-table"
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface DataTablePaginationProps<TData> {
    table: Table<TData>
}

/** Page size and page buttons (44px on phones). */
export function DataTablePagination<TData>({
    table,
}: DataTablePaginationProps<TData>) {
    const tablePageCount = table.getPageCount()
    // If pageCount is -1 (unknown), calculate from row count
    const pageCount =
        tablePageCount === -1
            ? Math.max(1, Math.ceil(table.getFilteredRowModel().rows.length / table.getState().pagination.pageSize))
            : Math.max(1, tablePageCount)
    const pageIndex = table.getState().pagination.pageIndex
    const selected = table.getFilteredSelectedRowModel().rows.length

    return (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 p-3">
            {selected > 0 && (
                <div className="w-full text-sm text-muted-foreground">
                    {selected} of {table.getFilteredRowModel().rows.length} selected
                </div>
            )}
            <div className="flex items-center gap-2">
                <label htmlFor="rows-per-page" className="text-sm font-medium">
                    <span className="hidden sm:inline">Rows per page</span>
                    <span className="sm:hidden">Show</span>
                </label>
                <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => {
                        table.setPageSize(Number(value))
                    }}
                >
                    <SelectTrigger id="rows-per-page" className="h-11 w-[76px] md:h-9">
                        <SelectValue placeholder={table.getState().pagination.pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                        {[10, 20, 25, 30, 40, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                                {pageSize}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                <span className="mr-1 whitespace-nowrap text-sm font-medium" aria-live="polite">
                    Page {pageIndex + 1} of {pageCount}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    className="hidden size-9 lg:flex"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                    aria-label="First page"
                >
                    <ChevronsLeft />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="size-11 md:size-9"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    aria-label="Previous page"
                >
                    <ChevronLeft />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="size-11 md:size-9"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    aria-label="Next page"
                >
                    <ChevronRight />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="hidden size-9 lg:flex"
                    onClick={() => table.setPageIndex(pageCount - 1)}
                    disabled={!table.getCanNextPage()}
                    aria-label="Last page"
                >
                    <ChevronsRight />
                </Button>
            </div>
        </div>
    )
}
