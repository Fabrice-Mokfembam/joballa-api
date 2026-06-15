/** Admin v2 responses: `{ success, data, meta? }` */
export function unwrapAdmin<T = unknown>(body: {
  success?: boolean;
  data?: T;
}): T {
  expect(body.success).toBe(true);
  return body.data as T;
}

/** Worker/employer paginated list: `{ data: [], page }` */
export function expectPaginated(body: unknown) {
  expect(body).toEqual(
    expect.objectContaining({
      data: expect.any(Array),
      page: expect.any(Number),
    }),
  );
}
