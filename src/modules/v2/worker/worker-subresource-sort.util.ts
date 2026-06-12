type DatedRow = {
  endDate?: Date | null;
  isCurrent?: boolean;
  createdAt: Date;
};

type CertificationRow = {
  expiryDate?: Date | null;
  issueDate?: Date | null;
  createdAt: Date;
};

function endSortKey(row: DatedRow): number {
  if (row.isCurrent || !row.endDate) return Number.MAX_SAFE_INTEGER;
  return row.endDate.getTime();
}

export function sortWorkOrEducationDesc<T extends DatedRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const endDiff = endSortKey(b) - endSortKey(a);
    if (endDiff !== 0) return endDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function sortCertificationsDesc<T extends CertificationRow>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const endA = a.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const endB = b.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (endB !== endA) return endB - endA;
    const issueDiff =
      (b.issueDate?.getTime() ?? 0) - (a.issueDate?.getTime() ?? 0);
    if (issueDiff !== 0) return issueDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
