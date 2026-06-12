export function parsePayPeriod(month?: number, year?: number): string {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split('-');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const idx = Number.parseInt(m ?? '1', 10) - 1;
  return `${monthNames[idx] ?? m} ${y}`;
}
