import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import api from "../../../api/http";
import "./RecentBlogs.css";

const RecentBlogs = () => {
  const [recentBlogs, setRecentBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { slug: currentSlug } = useParams();

  useEffect(() => {
    const loadRecentBlogs = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/v1/public/blogs", { params: { take: 4 } });
        const filtered = (Array.isArray(data) ? data : [])
          .filter((b) => b.slug !== currentSlug)
          .slice(0, 3);
        setRecentBlogs(filtered);
      } catch (err) {
        console.error("Error loading recent blogs:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRecentBlogs();
  }, [currentSlug]);

  const goToBlog = (blog) => {
    navigate(`/blogs/${blog.slug || blog.urlSlug}`);
  };

  return (
    <div className="recent-blogs-container">
      <h2 className="recent-title">Recent Blogs</h2>

      {loading ? (
        <div className="recent-loading">
          <ClipLoader color="#b78a4d" size={60} />
        </div>
      ) : recentBlogs.length === 0 ? (
        <div className="no-recent-blogs">
          <p>No other posts found.</p>
        </div>
      ) : (
        <div className="recent-blog-grid">
          {recentBlogs.map((blog, index) => (
            <div
              key={blog.id}
              className={`recent-blog-card fade-in-bottom delay-${index + 1}`}
              onClick={() => goToBlog(blog)}
            >
              {(blog.coverUrl || blog.imageBase64 || blog.imageLink) && (
                <div className="recent-img-wrapper">
                  <img
                    src={blog.coverUrl || blog.imageBase64 || blog.imageLink}
                    alt={blog.title}
                    className="recent-blog-img"
                  />
                </div>
              )}
              <div className="recent-blog-content">
                <h3>{blog.title}</h3>
                <p>{blog.formattedDate} • {blog.author}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentBlogs;
