export type CalendarRegion = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type CalendarLayoutConfig = {
  aspectRatio: number;
  closeButton: CalendarRegion;
  title: CalendarRegion;
  weekdayRow: CalendarRegion;
  body: CalendarRegion;
  footer: CalendarRegion;
  bodyGap: number;
  weekdayGap: number;
};

export const defaultCalendarLayout: CalendarLayoutConfig = {
  aspectRatio: 1394 / 1859,
  closeButton: {
    top: 0.055,
    left: 0.84,
    width: 0.08,
    height: 0.08,
  },
  title: {
    top: 0.106,
    left: 0.255,
    width: 0.37,
    height: 0.067,
  },
  weekdayRow: {
    top: 0.22,
    left: 0.08,
    width: 0.84,
    height: 0.065,
  },
  body: {
    top: 0.292,
    left: 0.08,
    width: 0.84,
    height: 0.438,
  },
  footer: {
    top: 0.715,
    left: 0.085,
    width: 0.83,
    height: 0.18,
  },
  bodyGap: 0.0012,
  weekdayGap: 0.01,
};
