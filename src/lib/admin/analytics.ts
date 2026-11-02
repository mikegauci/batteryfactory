export type AnalyticsOrder = {
  id: string;
  created_at: string;
  status: string;
  total_cents: number;
  currency: string;
};
export const maltaDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function addDays(day: string, amount: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function salesSummary(
  orders: AnalyticsOrder[],
  today: string,
  days: number,
) {
  const start = addDays(today, 1 - days);
  const previousStart = addDays(start, -days);
  const series = Array.from({ length: days }, (_, i) => ({
    day: addDays(start, i),
    revenue: 0,
    orders: 0,
  }));
  let revenue = 0,
    paid = 0,
    previousRevenue = 0,
    total = 0,
    pending = 0;
  for (const order of orders) {
    const day = maltaDay(new Date(order.created_at));
    if (
      day < previousStart ||
      day > today ||
      order.currency.toUpperCase() !== "EUR"
    )
      continue;
    const isPaid =
      order.status === "processing" || order.status === "completed";
    if (day < start) {
      if (isPaid) previousRevenue += order.total_cents;
      continue;
    }
    total++;
    if (order.status === "pending") pending++;
    if (!isPaid) continue;
    revenue += order.total_cents;
    paid++;
    const point = series.find((p) => p.day === day)!;
    point.revenue += order.total_cents;
    point.orders++;
  }
  return {
    start,
    revenue,
    paid,
    total,
    pending,
    average: paid ? Math.round(revenue / paid) : 0,
    previousRevenue,
    series,
  };
}
