export function buildCategoryTree(categories = []) {
  return categories
    .filter((category) => !category.parent_slug)
    .map((category) => ({
      ...category,
      children: categories.filter((child) => child.parent_slug === category.slug),
    }));
}

export function orderNiches(tree = []) {
  return [...tree].sort((a, b) => (b.children.length ? 1 : 0) - (a.children.length ? 1 : 0));
}