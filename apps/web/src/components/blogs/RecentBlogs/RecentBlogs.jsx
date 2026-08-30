import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminContext } from "../../../context/AdminContext";
import { ClipLoader } from "react-spinners";
import "./RecentBlogs.css";

const RecentBlogs = () => {
  const { fetchBlogs } = useAdminContext(); // Must fetch all blogs from _blogs
  const [recentBlogs, setRecentBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { blog: currentSlug } = useParams();

  useEffect(() => {
    const loadRecentBlogs = async () => {
      const cached = localStorage.getItem("cachedRecentBlogs");

      if (cached) {
        const parsed = JSON.parse(cached);
        setRecentBlogs(parsed);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const allBlogs = await fetchBlogs();

        const filtered = allBlogs
          .filter((b) => b?.createdAt?.seconds && b.urlSlug !== currentSlug)
          .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds) // Newest first
          .slice(0, 3) // Only 3 most recent
          .map((blog) => ({
            ...blog,
            formattedDate: new Date(blog.createdAt.seconds * 1000).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          }));

        localStorage.setItem("cachedRecentBlogs", JSON.stringify(filtered));
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
    navigate(`/blogs/${blog.urlSlug}`);
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
              {(blog.imageBase64 || blog.imageLink) && (
                <div className="recent-img-wrapper">
                  <img
                    src={blog.imageBase64 || blog.imageLink}
                    alt={blog.title}
                    className="recent-blog-img"
                  />
                  {/* <span className="category-tag">{blog.category || "Uncategorized"}</span> */}
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
