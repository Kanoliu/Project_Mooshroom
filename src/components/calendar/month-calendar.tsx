"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import calendarDayCell from "../../../art-resources/ui/Calender/Calender Cell 1.webp";
import calendarDayCell2 from "../../../art-resources/ui/Calender/Calender Cell 2.webp";
import calendarDayCell3 from "../../../art-resources/ui/Calender/Calender Cell 3.webp";
import calendarDayCell4 from "../../../art-resources/ui/Calender/Calender Cell 4.webp";
import calendarDayCell5 from "../../../art-resources/ui/Calender/Calender Cell 5.webp";
import calendarDayCell6 from "../../../art-resources/ui/Calender/Calender Cell 6.webp";
import calendarDayCell7 from "../../../art-resources/ui/Calender/Calender Cell 7.webp";
import calendarPanel from "../../../art-resources/ui/Calender/Calender Panel.webp";
import arrowLeft from "../../../art-resources/ui/arrow-left-216.webp";
import arrowRight from "../../../art-resources/ui/arrow-right-216.webp";
import { defaultCalendarLayout } from "@/lib/calendar/layout";
import { buildCalendarMonth } from "@/lib/calendar/month";
import styles from "./month-calendar.module.css";

const CALENDAR_DAY_CELLS = [
  calendarDayCell,
  calendarDayCell2,
  calendarDayCell3,
  calendarDayCell4,
  calendarDayCell5,
  calendarDayCell6,
  calendarDayCell7,
] as const;

const ROTATIONS = [0, 90, 180, 270] as const;

type MonthCalendarProps = {
  year: number;
  month: number;
  selectedDate?: string | null;
  eventStampByDate?: Record<string, string>;
  onSelectDate?: (isoDate: string) => void;
  footerContent?: ReactNode;
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  onClose?: () => void;
  className?: string;
};

export function MonthCalendar({
  year,
  month,
  selectedDate,
  eventStampByDate,
  onSelectDate,
  footerContent,
  onPreviousMonth,
  onNextMonth,
  onClose,
  className,
}: MonthCalendarProps) {
  const monthData = buildCalendarMonth(year, month);
  const displayRowCount = 6;
  const displayCellCount = displayRowCount * 7;
  const monthTitle = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(
    new Date(monthData.year, monthData.month - 1, 1),
  );
  const yearTitle = String(monthData.year);
  const calendarLabel = `${monthTitle} ${yearTitle}`;
  const visibleCells = [
    ...monthData.cells,
    ...Array.from({ length: Math.max(0, displayCellCount - monthData.cells.length) }, (_, index) =>
      createAdjacentDisplayCell(monthData.cells[monthData.cells.length - 1]?.isoDate, index + 1),
    ),
  ];
  const assignedVariantIndices: number[] = [];
  const decoratedCells = visibleCells.map((cell, index) => {
    const row = Math.floor(index / 7);
    const column = index % 7;
    const seed = `${monthData.year}-${monthData.month}-${cell.isoDate ?? "empty"}-${index}`;
    let tileVariantIndex = hashString(`${seed}-tile`) % CALENDAR_DAY_CELLS.length;
    const leftVariantIndex = column > 0 ? assignedVariantIndices[index - 1] : -1;
    const aboveVariantIndex = row > 0 ? assignedVariantIndices[index - 7] : -1;

    if (tileVariantIndex === leftVariantIndex || tileVariantIndex === aboveVariantIndex) {
      for (let offset = 1; offset < CALENDAR_DAY_CELLS.length; offset += 1) {
        const candidateIndex = (tileVariantIndex + offset) % CALENDAR_DAY_CELLS.length;

        if (candidateIndex !== leftVariantIndex && candidateIndex !== aboveVariantIndex) {
          tileVariantIndex = candidateIndex;
          break;
        }
      }
    }

    assignedVariantIndices[index] = tileVariantIndex;

    const rotationSeed = hashString(`${seed}-rotation`);
    const tileRotation = ROTATIONS[(rotationSeed + row + column) % ROTATIONS.length];

    return {
      ...cell,
      tileVariant: CALENDAR_DAY_CELLS[tileVariantIndex],
      tileRotation,
    };
  });

  const style = {
    "--calendar-aspect-ratio": String(defaultCalendarLayout.aspectRatio),
    "--calendar-close-top": String(defaultCalendarLayout.closeButton.top),
    "--calendar-close-left": String(defaultCalendarLayout.closeButton.left),
    "--calendar-close-width": String(defaultCalendarLayout.closeButton.width),
    "--calendar-close-height": String(defaultCalendarLayout.closeButton.height),
    "--calendar-title-top": String(defaultCalendarLayout.title.top),
    "--calendar-title-left": String(defaultCalendarLayout.title.left),
    "--calendar-title-width": String(defaultCalendarLayout.title.width),
    "--calendar-title-height": String(defaultCalendarLayout.title.height),
    "--calendar-body-top": String(defaultCalendarLayout.body.top),
    "--calendar-body-left": String(defaultCalendarLayout.body.left),
    "--calendar-body-width": String(defaultCalendarLayout.body.width),
    "--calendar-body-height": String(defaultCalendarLayout.body.height),
    "--calendar-footer-top": String(defaultCalendarLayout.footer.top),
    "--calendar-footer-left": String(defaultCalendarLayout.footer.left),
    "--calendar-footer-width": String(defaultCalendarLayout.footer.width),
    "--calendar-footer-height": String(defaultCalendarLayout.footer.height),
    "--calendar-grid-left": "7%",
    "--calendar-grid-width": "86%",
    "--calendar-grid-height": "85%",
  } as CSSProperties;

  return (
    <section className={`${styles.calendar} ${className ?? ""}`.trim()} style={style}>
      <Image
        src={calendarPanel}
        alt="Illustrated monthly calendar panel."
        fill
        priority
        className={styles.panelArt}
        sizes="(max-width: 768px) 94vw, 760px"
      />

      {onClose ? (
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close calendar">
          x
        </button>
      ) : null}

      <header className={styles.title} aria-label={calendarLabel}>
        {onPreviousMonth ? (
          <button
            type="button"
            className={`${styles.titleButton} ${styles.titleButtonPrev}`}
            onClick={onPreviousMonth}
            aria-label="Previous month"
          >
            <Image src={arrowLeft} alt="" fill className={styles.titleButtonArt} sizes="216px" />
          </button>
        ) : null}
        <div className={styles.titleCopy}>
          <span className={styles.titleMonth}>{monthTitle}</span>
          <span className={styles.titleYear}>{yearTitle}</span>
        </div>
        {onNextMonth ? (
          <button
            type="button"
            className={`${styles.titleButton} ${styles.titleButtonNext}`}
            onClick={onNextMonth}
            aria-label="Next month"
          >
            <Image src={arrowRight} alt="" fill className={styles.titleButtonArt} sizes="216px" />
          </button>
        ) : null}
      </header>

      <div className={styles.body}>
        <div className={styles.bodyGrid} role="grid" aria-label={calendarLabel}>
          {decoratedCells.map((cell, index) => {
            const isOutsideCurrentMonth = !cell.isCurrentMonth;
            const isSelected = !!cell.isoDate && cell.isoDate === selectedDate;
            const eventStamp = cell.isoDate ? eventStampByDate?.[cell.isoDate] : undefined;

            return (
              <button
                key={cell.isoDate ?? `empty-${index}`}
                type="button"
                className={`${styles.dayCell} ${isOutsideCurrentMonth ? styles.dayCellEmpty : ""} ${isSelected ? styles.dayCellSelected : ""}`.trim()}
                style={{ zIndex: eventStamp ? 3 : isSelected ? 2 : 1 }}
                role="gridcell"
                aria-label={cell.isoDate ?? undefined}
                aria-disabled={isOutsideCurrentMonth || undefined}
                disabled={isOutsideCurrentMonth}
                aria-selected={isSelected}
                onClick={() => {
                  if (cell.isoDate && !isOutsideCurrentMonth) {
                    onSelectDate?.(cell.isoDate);
                  }
                }}
              >
                <Image
                  src={cell.tileVariant}
                  alt=""
                  fill
                  className={`${styles.dayCellArt} ${isOutsideCurrentMonth ? styles.dayCellArtEmpty : ""}`.trim()}
                  style={{ transform: `rotate(${cell.tileRotation}deg)` }}
                  sizes="(max-width: 768px) 10vw, 96px"
                />
                <span
                  className={`${styles.dayNumber} ${cell.isToday ? styles.todayNumber : ""} ${isOutsideCurrentMonth ? styles.dayNumberMuted : ""}`.trim()}
                >
                  {cell.date}
                </span>
                {eventStamp ? (
                  <span className={styles.eventStamp}>
                    <img
                      src={eventStamp}
                      alt=""
                      className={styles.eventStampArt}
                      draggable={false}
                      aria-hidden="true"
                    />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <footer className={styles.footer}>
        {footerContent}
      </footer>
    </section>
  );
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function createAdjacentDisplayCell(fromIsoDate: string | undefined, offset: number) {
  const baseDate = fromIsoDate ? new Date(`${fromIsoDate}T00:00:00`) : new Date();
  const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offset);

  return {
    date: nextDate.getDate(),
    isoDate: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`,
    isToday: false,
    isCurrentMonth: false,
  };
}
