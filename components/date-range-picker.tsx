"use client"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { addDays, format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import * as React from "react"
import { type DateRange } from "react-day-picker"

export default function DateRangePicker({
  className,
  value,
  defaultValue,
  onRangeChange,
  numberOfMonths = 2,
  buttonClassName,
}: Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value?: DateRange
  defaultValue?: DateRange
  onRangeChange?: (range?: DateRange) => void
  numberOfMonths?: number
  buttonClassName?: string
}) {
  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>(
    defaultValue ?? {
      from: addDays(new Date(), -20),
      to: new Date(),
    }
  )

  const date = value ?? internalDate

  const setDate = React.useCallback(
    (next?: DateRange) => {
      onRangeChange?.(next)
      if (value === undefined) setInternalDate(next)
    },
    [onRangeChange, value]
  )

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground",
              buttonClassName
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={numberOfMonths}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
