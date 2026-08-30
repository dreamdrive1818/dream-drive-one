import React, { useEffect, useState } from 'react';
import { useAdminContext } from '../../context/AdminContext';
import './BlogCateList.css'; // Optional: create CSS for styling

const BlogCateList = () => {
  const { fetchCategories } = useAdminContext();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };

    getCategories();
  }, [fetchCategories]);

  if (loading) return <p>Loading categories...</p>;

  return (
    <div className="blog-cate-list">
      <h2>Blog Categories</h2>
      {categories.length === 0 ? (
        <p>No categories found.</p>
      ) : (
        <ul>
          {categories.map((cat) => (
            <li key={cat.id}>{cat.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BlogCateList;
