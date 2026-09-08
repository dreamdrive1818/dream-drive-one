import { useEffect, useState } from "react";
import "./Blogs.css";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import api from "../../api/http";
import { useBlogContext } from "../../context/BlogContext";

const FALLBACK_COVERS = [
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
];

function plainText(value, max = 120) {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "Tips, routes, and checklists for better self-drive trips from Ranchi.";
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function coverFor(blog, index) {
  return (
    blog.coverUrl ||
    blog.imageBase64 ||
    blog.imageLink ||
    FALLBACK_COVERS[index % FALLBACK_COVERS.length]
  );
}

const Blogs = () => {
  const [blogPosts, setBlogPosts] = useState([]);
  const { setSelectedUserBlog } = useBlogContext();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const { data } = await api.get("/v1/public/blogs", { params: { take: 6 } });
        const blogData = (Array.isArray(data) ? data : []).map((doc) => ({
          id: doc.id,
          ...doc,
          formattedDate: doc.formattedDate || "Date not available",
        }));
        setBlogPosts(blogData.slice(0, 3));
      } catch {
        setBlogPosts([]);
      }
    };

    fetchBlogs();
  }, []);

  const handleBlogClick = (blog) => {
    setSelectedUserBlog(blog);
    const formattedTitle = blog.title.toLowerCase().replace(/\s+/g, "-");
    navigate(`/blogs/${blog.slug || blog.urlSlug || formattedTitle}`);
  };

  return (
    <section className="home-guides" aria-label="Guides and trip ideas">
      <div className="home-guides-inner">
        <header className="home-guides-header">
          <p className="home-guides-kicker">From the journal</p>
          <h2 className="home-guides-title">Guides & trip ideas</h2>
          <p className="home-guides-lead">
            Routes, checklists, and weekend plans for self-drive days out of Ranchi.
          </p>
        </header>

        {blogPosts.length > 0 ? (
          <div className="home-guides-grid">
            {blogPosts.map((blog, index) => (
              <article
                key={blog.id}
                className="home-guides-card"
                onClick={() => handleBlogClick(blog)}
              >
                <div className="home-guides-media">
                  <img src={coverFor(blog, index)} alt="" loading="lazy" />
                </div>
                <div className="home-guides-body">
                  <p className="home-guides-meta">
                    <span>{blog.formattedDate}</span>
                    {blog.author ? <span>• {blog.author}</span> : null}
                  </p>
                  <h3 className="home-guides-card-title">{blog.title}</h3>
                  <p className="home-guides-excerpt">
                    {plainText(blog.excerpt || blog.content || blog.body)}
                  </p>
                  <span className="home-guides-link">
                    Read more
                    <FontAwesomeIcon icon={faArrowRight} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="home-guides-empty">Guides are on the way. Check back soon.</p>
        )}

        <div className="home-guides-footer">
          <button
            type="button"
            className="home-guides-cta"
            onClick={() => navigate("/blogs")}
          >
            Explore our blogs
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Blogs;
