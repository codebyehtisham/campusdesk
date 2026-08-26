export const deptEnabled = (org, dept) => {
  if (org?.departments?.includes(dept.slug)) return true;
  const slugs = (dept.modules || []).map((item) => item.slug);
  return slugs.some((slug) => (org?.modules || []).includes(slug));
};

export const deptNamesForOrg = (org, departments = []) => {
  if (org?.departments?.length && departments.length) {
    return org.departments
      .map((slug) => departments.find((item) => item.slug === slug)?.name || slug)
      .filter(Boolean);
  }
  if (org?.departments?.length) return org.departments;
  return [];
};
