/**
 * Sorts blogs by date (formattedDate or createdAt).
 * @param {Array} blogs - Array of blog objects.
 * @param {'newest'|'oldest'} order - Sorting order.
 * @returns {Array} - Sorted blogs array.
 */
export const sortBlogsByDate = (blogs, order = 'newest') => {
  return [...blogs].sort((a, b) => {
    const dateA = a.formattedDate
      ? new Date(a.formattedDate)
      : new Date(a.createdAt?.seconds * 1000 || 0);
    const dateB = b.formattedDate
      ? new Date(b.formattedDate)
      : new Date(b.createdAt?.seconds * 1000 || 0);

    return order === 'newest' ? dateB - dateA : dateA - dateB;
  });
};
