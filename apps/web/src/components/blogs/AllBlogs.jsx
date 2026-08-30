import { useEffect, useState } from "react";
import "./AllBlogs.css";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { useLocalContext } from "../../context/LocalContext";
import { useAdminContext } from "../../context/AdminContext";
import RecentBlogs from "./RecentBlogs/RecentBlogs";
import { Helmet } from "react-helmet-async"; // ✅ switched to async
import { sortBlogsByDate } from "../../utils/sortBlogsByDate";
import { useBlogContext } from "../../context/BlogContext";
import { usePageSeoSuppression } from "../../utils/usePageSeoSuppression";

const toAbsolute = (base, path = "") => {
  if (!base) return "";
  try {
    return new URL(path || "/", base).toString();
  } catch {
    return "";
  }
};

const AllBlogs = () => {
  const { category } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  usePageSeoSuppression(true)

  const { pageSeo, webinfo } = useLocalContext(); // ✅ use SEO defaults if present
  const { fetchBlogs, fetchBlogsFromCategory, fetchCategoryById } = useAdminContext();
  const { setSelectedUserBlog } = useBlogContext();

  const [blogPosts, setBlogPosts] = useState([]);
  const [originalPosts, setOriginalPosts] = useState([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState("newest");
  const [isSorting, setIsSorting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // ------- load blogs -------
  useEffect(() => {
    const loadBlogs = async () => {
      setLoading(true);
      setOriginalPosts([]);
      setBlogPosts([]);
      try {
        const blogs =
          !category || category === "all"
            ? await fetchBlogs()
            : await fetchBlogsFromCategory(category);

        const formatted = blogs.map((blog) => ({
          ...blog,
          formattedDate: blog.formattedDate
            ? new Date(blog.formattedDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : blog.createdAt?.seconds
            ? new Date(blog.createdAt.seconds * 1000).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "Date not available",
        }));

        setOriginalPosts(formatted);
      } catch (err) {
        console.error("Failed to fetch blogs:", err);
        setOriginalPosts([]);
      } finally {
        setLoading(false);
      }
    };
    loadBlogs();
  }, [category, fetchBlogs, fetchBlogsFromCategory]);

  // ------- sorting -------
  useEffect(() => {
    if (originalPosts.length === 0) return;
    setLoading(true);
    setIsSorting(true);
    const sorted = sortBlogsByDate(originalPosts, sortOrder);
    setBlogPosts(sorted);
    setCurrentPage(1);
    const timer = setTimeout(() => {
      setLoading(false);
      setIsSorting(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [sortOrder, originalPosts]);

  // ------- pagination -------
  const handlePagination = (value) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setLoading(true);
    setCurrentPage(value);
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  };

  // ------- fetch SEO for category/list -------
  useEffect(() => {
    const fetchSeo = async () => {
      try {
        if (!category || category === "all") {
          setSeoTitle("All Blogs");
          setSeoDescription("Browse all blog posts across categories.");
          setSeoKeywords("blogs, articles, posts");
        } else {
          const catData = await fetchCategoryById(category);
          setSeoTitle(catData?.seoTitle || catData?.name || "Category");
          setSeoDescription(catData?.seoDescription || "Latest posts in this category.");
          setSeoKeywords(catData?.seoKeywords || "blog, category");
        }
      } catch (err) {
        console.error("Failed to fetch SEO metadata", err);
      }
    };
    fetchSeo();
  }, [category, fetchCategoryById]);

  const handleBlogClick = (blog) => {
    setSelectedUserBlog(blog);
    navigate(`/blogs/${blog.urlSlug}`);
  };

  // ------- pagination calc -------
  const paginatedPosts = blogPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(blogPosts.length / pageSize);

  if (loading) {
    return (
      <div className="loader-wrapper">
        <ClipLoader color="#b78a4d" size={80} />
      </div>
    );
  }

  // ------- SEO (react-helmet-async) -------
  const siteUrl = webinfo?.seo?.siteUrl || "https://yourdomain.com";
  const canonical = toAbsolute(siteUrl, `${location.pathname}${location.search || ""}`);

  // Merge with global defaults if you want (optional sugar)
  const seo = pageSeo
    ? pageSeo({
        defaultTitle: seoTitle,
        description: seoDescription,
        ogImage: webinfo?.seo?.ogImage,
      })
    : {
        defaultTitle: seoTitle,
        description: seoDescription,
        ogImage: webinfo?.seo?.ogImage,
      };

  return (
    <>
      <Helmet>
        <title>{seo.defaultTitle}</title>
        <meta name="description" content={seo.description} />
        {seoKeywords && <meta name="keywords" content={seoKeywords} />}

        {/* Canonical + OG/Twitter */}
        {canonical && <link rel="canonical" href={canonical} />}
        {canonical && <meta property="og:url" content={canonical} />}

        <meta property="og:title" content={seo.defaultTitle} />
        <meta property="og:description" content={seo.description} />
        {seo.ogImage && <meta property="og:image" content={seo.ogImage} />}
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        {webinfo?.seo?.twitterHandle && (
          <meta name="twitter:site" content={webinfo.seo.twitterHandle} />
        )}
        <meta name="twitter:title" content={seo.defaultTitle} />
        <meta name="twitter:description" content={seo.description} />
        {seo.ogImage && <meta name="twitter:image" content={seo.ogImage} />}
      </Helmet>

      <div className="AllBlogs">
        {blogPosts.length === 0 ? (
          <div className="user-no-blogs-message fadeup">
            <h2>No Blogs Found</h2>
            <p>
              It looks like we haven’t added any blogs to this category yet.<br />
              Please check back later or explore other categories.
            </p>
            <button className="user-read-more-btn" onClick={() => navigate("/blogs")}>
              View All Blogs
            </button>
          </div>
        ) : (
          <div className="user-blogs-grid">
            <div className="sort-section">
              <div className="sort-dropdown">
                <label htmlFor="sort">Sort by Date: </label>
                <select
                  id="sort"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>

              {isSorting && <div className="sorting-indicator">Sorting...</div>}
            </div>

            <div className="user-blogs-list">
              {paginatedPosts.map((blog) => (
                <div
                  className="user-blog-card fade-in-bottom"
                  key={blog.id}
                  onClick={() => handleBlogClick(blog)}
                >
                  <div className="user-blog-card-top">
                    <h3 className="user-blog-title">{blog.title}</h3>
                    <p className="user-blog-meta">
                      <span>{blog.formattedDate}</span> • By <span>{blog.author}</span>
                    </p>
                  </div>
                  {(blog.imageBase64 || blog.imageLink) && (
                    <img
                      src={blog.imageBase64 || blog.imageLink}
                      alt="Blog"
                      className="user-blog-image"
                      loading="lazy"
                    />
                  )}
                  <p className="user-blog-description">
                    {blog.content.replace(/<[^>]+>/g, "").slice(0, 300)}...
                  </p>
                  <button
                    className="user-read-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBlogClick(blog);
                    }}
                  >
                    Read More
                  </button>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    className={`page-btn ${currentPage === i + 1 ? "active" : ""}`}
                    onClick={() => handlePagination(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <RecentBlogs />
    </>
  );
};

export default AllBlogs;
