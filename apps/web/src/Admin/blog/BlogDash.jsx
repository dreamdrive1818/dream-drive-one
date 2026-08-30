import React, { useEffect, useState } from 'react';
import './BlogDash.css';
import BlogList from './BlogList';
import AddBlogForm from './AddBlogForm';
import AddCategoryModal from './AddCategoryModal';
import { useAdminContext } from '../../context/AdminContext';

const BlogDash = () => {
  const [showAddBlog, setShowAddBlog] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSeoModal, setShowSeoModal] = useState(false);
  const [reloadBlogsTrigger, setReloadBlogsTrigger] = useState(0);

  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');

  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCategoryDetails, setActiveCategoryDetails] = useState(null);
  const [blogs, setBlogs] = useState([]);
  const [allBlogs, setAllBlogs] = useState([]); // 🆕

  const {
    fetchCategories,
    fetchCategoryById,
    fetchBlogs,
    fetchBlogsFromCategory,
    deleteCategory,
    updateCategory
  } = useAdminContext();

  useEffect(() => {
    if (activeCategory === 'all') {
      setActiveCategoryDetails(null);
      return;
    }

    let cancelled = false;

    const loadCategoryDetails = async () => {
      try {
        const details = await fetchCategoryById(activeCategory);
        if (!cancelled) {
          setActiveCategoryDetails(details);
          setSeoTitle(details?.seoTitle || '');
          setSeoDescription(details?.seoDescription || '');
          setSeoKeywords(details?.seoKeywords || '');
        }
      } catch (err) {
        console.error('Failed to fetch category details:', err);
        setActiveCategoryDetails(null);
      }
    };

    loadCategoryDetails();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, fetchCategoryById]);

  useEffect(() => {
    const loadBlogs = async () => {
      try {
        const all = await fetchBlogs();
        setAllBlogs(all); // 🆕 for counts

        const data = activeCategory === 'all'
          ? all
          : await fetchBlogsFromCategory(activeCategory);

        setBlogs(data);
      } catch (err) {
        console.error('Failed to load blogs:', err);
      }
    };

    loadBlogs();
  }, [activeCategory, fetchBlogs, fetchBlogsFromCategory, reloadBlogsTrigger]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    loadCategories();
  }, [fetchCategories]);

  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm("Are you sure you want to delete this category?")) {
      try {
        await deleteCategory(categoryId);
        const refreshed = await fetchCategories();
        setCategories(refreshed);
        if (activeCategory === categoryId) setActiveCategory('all');
      } catch (error) {
        console.error("Failed to delete category", error);
      }
    }
  };

  const handleEditCategory = (cat) => {
    const newName = prompt("Edit category name:", cat.name);
    if (newName && newName !== cat.name) {
      updateCategory(cat.id, { name: newName })
        .then(async () => {
          const refreshed = await fetchCategories();
          setCategories(refreshed);
        })
        .catch((err) => console.error("Failed to update category", err));
    }
  };

  const handleSaveSeo = async () => {
    try {
      await updateCategory(activeCategory, {
        ...activeCategoryDetails,
        seoTitle,
        seoDescription,
        seoKeywords,
        updatedAt: new Date(),
      });
      setShowSeoModal(false);
    } catch (err) {
      console.error("Failed to save SEO settings", err);
    }
  };

  const refreshBlogs = async () => {
    const all = await fetchBlogs();
    setAllBlogs(all); // 🆕
    const data = activeCategory === 'all'
      ? all
      : await fetchBlogsFromCategory(activeCategory);
    setBlogs(data);
  };

  const getBlogCount = (categoryId) => {
    return allBlogs.filter(blog => blog.category === categoryId).length;
  };

  return (
    <div className="blog-dash">
      <div className="blog-dash-actions">
        <button className="add-blog-btn" onClick={() => setShowAddBlog(true)}>Add Blog</button>
        {/* <button className="add-blog-btn add-category-btn" onClick={() => setShowCategoryModal(true)}>Add Category</button> */}
      </div>

      <div className="blog-category-nav">
        <button className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')}>
          All <span className="badge">{allBlogs.length}</span>
        </button>
        {categories.map((cat) => (
          <div key={cat.id} className="category-item">
            <button className={activeCategory === cat.id ? 'active' : ''} onClick={() => setActiveCategory(cat.id)}>
              {cat.name} <span className="badge">{getBlogCount(cat.id)}</span>
            </button>
          </div>
        ))}
      </div>

      {activeCategoryDetails && activeCategory !== 'all' && (
        <div className="category-meta">
          <p><strong>Category:</strong> {activeCategoryDetails.name}</p>
          <p><strong>Created:</strong> {new Date(activeCategoryDetails.createdAt.toDate()).toLocaleDateString()}</p>

          <div className="seo-details">
            <p><strong>SEO Title:</strong> {seoTitle || <em>Not set</em>}</p>
            <p><strong>Meta Description:</strong> {seoDescription || <em>Not set</em>}</p>
            <p><strong>Keywords:</strong> {seoKeywords || <em>Not set</em>}</p>
          </div>

          <div className="category-meta-actions">
            <button className="edit-btn" onClick={() => handleEditCategory(activeCategoryDetails)}>✏️ Edit</button>
            <button className="delete-btn" onClick={() => handleDeleteCategory(activeCategoryDetails.id)}>🗑️ Delete</button>
            <button className="seo-btn edit-btn" onClick={() => setShowSeoModal(true)}>🔍 SEO</button>
          </div>
        </div>
      )}

      <div className="blog-list">
        <BlogList blogs={blogs} count="all" main={true} category={activeCategory} onRefresh={refreshBlogs} />
      </div>

      {showSeoModal && (
        <div className="seo-modal-overlay">
          <div className="seo-modal">
            <h2>Category SEO Settings</h2>
            <label>SEO Title</label>
            <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Enter SEO title" />
            <label>Meta Description</label>
            <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Enter meta description" />
            <label>Keywords</label>
            <input type="text" value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} placeholder="e.g., blog, category, article" />
            <div className="seo-modal-actions">
              <button onClick={handleSaveSeo} className="save-btn">Save</button>
              <button onClick={() => setShowSeoModal(false)} className="close-b">Close</button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && <AddCategoryModal onClose={() => setShowCategoryModal(false)} />}
      {showAddBlog && (
        <AddBlogForm
          onClose={() => setShowAddBlog(false)}
          onSuccess={() => setReloadBlogsTrigger(prev => prev + 1)}
        />
      )}
    </div>
  );
};

export default BlogDash;
