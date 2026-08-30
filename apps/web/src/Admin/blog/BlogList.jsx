import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './BlogList.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencil, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useAdminContext } from '../../context/AdminContext';

const BlogList = ({ blogs = [], count = 'all', main = false ,onRefresh}) => {
  const navigate = useNavigate();
  const { selectBlog, deleteBlog } = useAdminContext();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 200); // 200ms delay
    return () => clearTimeout(timeout);
  }, [blogs]);

  const formatDate = (date) => {
    if (!date) return '';
    const parsed = new Date(date.seconds ? date.seconds * 1000 : date);
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleBlogClick = (blog) => {
    selectBlog(blog);
    const formattedTitle = blog.title.toLowerCase().replace(/\s+/g, '-');
    navigate(`/blogs/${blog.category}/${formattedTitle}`);
  };

  const handleEdit = (blog) => {
    selectBlog(blog);
    navigate('/admin/blog/edit');
  };

  const handleDelete = async (blog) => {
    if (window.confirm(`Delete "${blog.title}"? This cannot be undone.`)) {
      try {
        await deleteBlog(blog.id, blog.category);
onRefresh && onRefresh(); // ✅ Trigger parent refresh
 // Or use state to refetch
      } catch (err) {
        console.error("Delete error:", err.message);
      }
    }
  };

  const displayedBlogs = count === "all"
    ? blogs
    : blogs.slice(0, parseInt(count));

  if (isLoading) {
    return (
      <div className="spinner-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="blogs-container">
      <div className="blog-container-head">
        <h2>Your Blogs ↓</h2>
      </div>

      <div className="blog-container-div">
        {displayedBlogs.map((blog) => {
          const shortContent = blog.content.replace(/<[^>]+>/g, '').slice(0, 200);
          const isLong = blog.content.length > 200;

          return (
            <div key={blog.id} className="blog-card">
              <div className="blog-image" onClick={() => handleBlogClick(blog)}>
                {(blog.imageBase64 || blog.imageLink) && (
                  <img src={blog.imageBase64 || blog.imageLink} alt="Blog" />
                )}
              </div>
              <div className="blog-content">
                <h3 onClick={() => handleBlogClick(blog)}>{blog.title}</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  {shortContent}
                  {isLong && "... "}
                  {isLong && (
                    <button
                      className="read-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBlogClick(blog);
                      }}
                    >
                      <span>Read More</span>
                    </button>
                  )}
                </p>
                <p><strong>Category:</strong> {blog.category}</p>
                <p><strong>Date:</strong> {formatDate(blog.formattedDate)}</p>
                <p><strong>Created At:</strong> {formatDate(blog.createdAt)}</p>

                {main && (
                  <div className="blog-actions">
                    <button className="edit-btn" onClick={() => handleEdit(blog)}>
                      <FontAwesomeIcon icon={faPencil} /> Edit
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(blog)}>
                      <FontAwesomeIcon icon={faTrash} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BlogList;
