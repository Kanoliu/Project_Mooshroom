const MONDAY_FIRST_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type CalendarCell = {
  date: number;
  isoDate: string;
  isToday: boolean;
  isCurrentMonth: boolean;
};

export type CalendarMonthData = {
  year: number;
  month: number;
  monthLabel: string;
  weekdayLabels: readonly string[];
  daysInMonth: number;
  startWeekday: number;
  rowCount: number;
  cells: CalendarCell[];
};

export function buildCalendarMonth(year: number, month: number): CalendarMonthData {
  const normalizedMonth = clampMonth(month);
  const firstOfMonth = new Date(year, normalizedMonth - 1, 1);
  const daysInMonth = new Date(year, normalizedMonth, 0).getDate();
  const startWeekday = toMondayFirstIndex(firstOfMonth.getDay());
  const today = new Date();
  const previousMonthDate = new Date(year, normalizedMonth - 2, 1);
  const previousMonthDays = new Date(year, normalizedMonth - 1, 0).getDate();
  const leadingCells = Array.from({ length: startWeekday }, (_, index) =>
    createCell(
      new Date(
        previousMonthDate.getFullYear(),
        previousMonthDate.getMonth(),
        previousMonthDays - startWeekday + index + 1,
      ),
      today,
      false,
    ),
  );
  const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
    return createCell(new Date(year, normalizedMonth - 1, index + 1), today, true);
  });
  const trailingCellCount = (7 - ((leadingCells.length + dayCells.length) % 7)) % 7;
  const trailingCells = Array.from({ length: trailingCellCount }, (_, index) =>
    createCell(new Date(year, normalizedMonth, index + 1), today, false),
  );
  const cells = [...leadingCells, ...dayCells, ...trailingCells];
  const rowCount = cells.length / 7;

  return {
    year,
    month: normalizedMonth,
    monthLabel: new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(firstOfMonth),
    weekdayLabels: MONDAY_FIRST_WEEKDAYS,
    daysInMonth,
    startWeekday,
    rowCount,
    cells,
  };
}

function createCell(date: Date, today: Date, isCurrentMonth: boolean): CalendarCell {
  return {
    date: date.getDate(),
    isoDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    isToday:
      today.getFullYear() === date.getFullYear() &&
      today.getMonth() === date.getMonth() &&
      today.getDate() === date.getDate(),
    isCurrentMonth,
  };
}

function clampMonth(month: number) {
  if (month < 1) {
    return 1;
  }

  if (month > 12) {
    return 12;
  }

  return month;
}

function toMondayFirstIndex(day: number) {
  return (day + 6) % 7;
}
