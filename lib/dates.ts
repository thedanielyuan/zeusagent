export interface DateGroup<T> {
  label: string;
  items: T[];
}

/** Groups items, already sorted newest first, under "Today", "Yesterday", … headings. */
export function groupByDate<T>(items: T[], getTime: (item: T) => number): DateGroup<T>[] {
  const now = new Date();
  const [year, month, day] = [now.getFullYear(), now.getMonth(), now.getDate()];
  const today = new Date(year, month, day).getTime();
  const yesterday = new Date(year, month, day - 1).getTime();
  const lastWeek = new Date(year, month, day - 7).getTime();
  const lastMonth = new Date(year, month, day - 30).getTime();

  const groups: DateGroup<T>[] = [];
  for (const item of items) {
    const time = getTime(item);
    const label =
      time >= today
        ? "Today"
        : time >= yesterday
          ? "Yesterday"
          : time >= lastWeek
            ? "Previous 7 days"
            : time >= lastMonth
              ? "Previous 30 days"
              : monthLabel(time, year);

    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function monthLabel(time: number, currentYear: number): string {
  const date = new Date(time);
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: date.getFullYear() === currentYear ? undefined : "numeric",
  });
}
