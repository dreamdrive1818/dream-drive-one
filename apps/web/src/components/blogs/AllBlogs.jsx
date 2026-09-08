import { useEffect, useState } from "react";
import "./AllBlogs.css";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { ClipLoader } from "react-spinners";
import { useLocalContext } from "../../context/LocalContext";
import { useAdminContext } from "../../context/AdminContext";
import { Helmet } from "react-helmet-async";
import { sortBlogsByDate } from "../../utils/sortBlogsByDate";
import { useBlogContext } from "../../context/BlogContext";
import { usePageSeoSuppression } from "../../utils/usePageSeoSuppression";

const FALLBACK_COVERS = [
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
];

const toAbsolute = (base, path = "") => {
  if (!base) return "";
  try {
    return new URL(path || "/", base).toString();
  } catch {
    return "";
  }
};

function plainText(value, max = 140) {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "Tips and trip ideas from Dream Drive.";
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

const AllBlogs = () => {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");
  const location = useLocation();
  const navigate = useNavigate();
  usePageSeoSuppression(true);

  const { pageSeo, webinfo } = useLocalContext();
  const { fetchBlogs, fetchBlogsFromCategory, fetchCategoryById } =
    useAdminContext();
  const { setSelectedUserBlog } = useBlogContext();

  const [blogPosts, setBlogPosts] = useState([]);
  const [originalPosts, setOriginalPosts] = useState([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

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
          formattedDate:
            blog.formattedDate ||
            (blog.publishedAt || blog.createdAt
              ? new Date(blog.publishedAt || blog.createdAt).toLocaleDateString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )
              : "Date not available"),
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

  useEffect(() => {
    if (originalPosts.length === 0) {
      setBlogPosts([]);
      return;
    }
    const sorted = sortBlogsByDate(originalPosts, sortOrder);
    setBlogPosts(sorted);
    setCurrentPage(1);
  }, [sortOrder, originalPosts]);

  useEffect(() => {
    const fetchSeo = async () => {
      try {
        if (!category || category === "all") {
          setSeoTitle("Guides & trip ideas | Dream Drive");
          setSeoDescription(
            "Browse Dream Drive guides, checklists, and trip ideas for self-drive travel from Ranchi."
          );
          setSeoKeywords("blogs, self drive, ranchi, trip ideas");
        } else {
          const catData = await fetchCategoryById(category);
          setSeoTitle(catData?.seoTitle || catData?.name || "Category");
          setSeoDescription(
            catData?.seoDescription || "Latest posts in this category."
          );
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
    navigate(`/blogs/${blog.slug || blog.urlSlug}`);
  };

  const handlePagination = (value) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setCurrentPage(value);
  };

  const paginatedPosts = blogPosts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(blogPosts.length / pageSize) || 1;

  const siteUrl = webinfo?.seo?.siteUrl || "https://yourdomain.com";
  const canonical = toAbsolute(
    siteUrl,
    `${location.pathname}${location.search || ""}`
  );

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

  if (loading) {
    return (
      <div className="blogs-page-loader">
        <ClipLoader color="#0e7c86" size={48} />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{seo.defaultTitle}</title>
        <meta name="description" content={seo.description} />
        {seoKeywords ? <meta name="keywords" content={seoKeywords} /> : null}
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        {canonical ? <meta property="og:url" content={canonical} /> : null}
        <meta property="og:title" content={seo.defaultTitle} />
        <meta property="og:description" content={seo.description} />
        {seo.ogImage ? <meta property="og:image" content={seo.ogImage} /> : null}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        {webinfo?.seo?.twitterHandle ? (
          <meta name="twitter:site" content={webinfo.seo.twitterHandle} />
        ) : null}
        <meta name="twitter:title" content={seo.defaultTitle} />
        <meta name="twitter:description" content={seo.description} />
        {seo.ogImage ? (
          <meta name="twitter:image" content={seo.ogImage} />
        ) : null}
      </Helmet>

      <section className="blogs-page" aria-label="Blogs">
        <div className="blogs-page-inner">
          <header className="blogs-page-header">
            <p className="blogs-page-eyebrow">Journal</p>
            <h1>
              {!category || category === "all"
                ? "Guides & trip ideas"
                : seoTitle}
            </h1>
            <p className="blogs-page-lead">
              Routes, checklists, and weekend plans for self-drive days out of
              Ranchi.
            </p>
          </header>

          {blogPosts.length === 0 ? (
            <div className="blogs-page-empty">
              <h2>No blogs found</h2>
              <p>
                Nothing in this category yet. Check back soon or browse all
                posts.
              </p>
              <button type="button" onClick={() => navigate("/blogs")}>
                View all blogs
              </button>
            </div>
          ) : (
            <>
              <div className="blogs-page-toolbar">
                <p className="blogs-page-count">
                  {blogPosts.length} post{blogPosts.length === 1 ? "" : "s"}
                </p>
                <label className="blogs-page-sort">
                  <span>Sort</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>
              </div>

              <div className="blogs-page-grid">
                {paginatedPosts.map((blog, index) => (
                  <article
                    key={blog.id}
                    className="blogs-page-card"
                    onClick={() => handleBlogClick(blog)}
                  >
                    <div className="blogs-page-media">
                      <img
                        src={coverFor(blog, index)}
                        alt=""
                        loading="lazy"
                      />
                    </div>
                    <div className="blogs-page-body">
                      <p className="blogs-page-meta">
                        <span>{blog.formattedDate}</span>
                        {blog.author ? <span>• {blog.author}</span> : null}
                      </p>
                      <h2>{blog.title}</h2>
                      <p>
                        {plainText(
                          blog.excerpt || blog.content || blog.body
                        )}
                      </p>
                      <span className="blogs-page-link">
                        Read more
                        <FontAwesomeIcon icon={faArrowRight} />
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="blogs-page-pagination" aria-label="Pagination">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={currentPage === i + 1 ? "is-active" : ""}
                      onClick={() => handlePagination(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  );
};

export default AllBlogs;
