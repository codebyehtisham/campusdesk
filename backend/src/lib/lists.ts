/** Coerce Prisma Json list fields to string[]. */
export const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
};
