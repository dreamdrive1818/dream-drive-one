import  { useEffect, useState } from "react";
import "./Blogs.css";
import { useNavigate } from "react-router-dom";
import api from "../../api/http";
import { useBlogContext } from "../../context/BlogContext";

const Blogs = () => {
  const [blogPosts, setBlogPosts] = useState([]);
  const { setSelectedUserBlog } = useBlogContext();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBlogs = async () => {
      const { data } = await api.get("/api/cms/blogs");
      const blogData = data.map((doc) => ({
          id: doc.id,
          ...doc,
          formattedDate: doc.date
            ? new Date(doc.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "Date not available",
      }));
      setBlogPosts(blogData);
    };
    
    fetchBlogs();
  }, []);

  const handleBlogClick = (blog) => {
    setSelectedUserBlog(blog);
    const formattedTitle = blog.title.toLowerCase().replace(/\s+/g, '-');  // Replace spaces with hyphens
    navigate(`/blog/${formattedTitle}`);
  };

  return (
    <>
      <div className="categories-header">
        <div className="head">
          <div></div>
          <h2 className="categories-heading">Stay Ahead in Cybersecurity</h2>
        </div>
      </div>
      <div className="blogs-section blogs-section-user">
        <div className="blogs-grid">
          {blogPosts.map((blog) => (
            <div className="blog-card" key={blog.id} onClick={() => handleBlogClick(blog)}>
              <div className="blog-card-top">
                <h3 className="blog-title">{blog.title}</h3>
                <p className="blog-meta">
                  <span>{blog.formattedDate}</span> • <span>{blog.author}</span>
                </p>
              </div>
              <div className="blog-card-bot">
                <div className="blog-content">
                  {(blog.imageBase64 || blog.imageLink) && (
                    <img
                      src={blog.imageBase64 || blog.imageLink}
                      alt="Blog"
                      className="blog-image"
                    />
                  )}
                  <div className="blog-content-right">
                    <p className="blog-description">
                      {blog.content.replace(/<[^>]+>/g, "").slice(0, 180)}...
                    </p>
                    <button className="blog-btn" onClick={() => handleBlogClick(blog)}>
                      Read More
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="blogs-footer">
          <button className="explore-button" onClick={() => navigate('/blogs')}>
            Explore Our Blogs
          </button>
        </div>
      </div>
    </>
  );
};

export default Blogs;
