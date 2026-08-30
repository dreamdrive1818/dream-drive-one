import React, { useEffect, useState } from "react";
import { useAdminContext } from "../../../context/AdminContext";
import { useNavigate } from "react-router-dom";
import "./AllCategories.css";
import { FaFolderOpen } from "react-icons/fa";


const AllCategories = () => {
  const [categories, setCategories] = useState([]);
  const { fetchCategories } = useAdminContext();
  const navigate = useNavigate();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (err) {
        console.error("Error loading categories", err);
      }
    };

    loadCategories();
  }, [fetchCategories]);

  const handleCategoryClick = (catId) => {
    navigate(`/blogs/${catId}`);
  };

  return (
    <div className="category-sidebar">
      <h3 className="category-heading"> <FaFolderOpen className="category-icon" /> Categories</h3>
      <ul className="category-list">
        {categories.map((cat) => (
          <li key={cat.id} onClick={() => handleCategoryClick(cat.id)} className="category-item">
            {cat.name} ↗
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AllCategories;
