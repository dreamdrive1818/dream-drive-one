import { useEffect, useMemo, useState } from "react";
import "./AllBlogs.css";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import { useAdminContext } from "../../context/AdminContext";
import { Helmet } from "react-helmet-async";
import { sortBlogsByDate } from "../../utils/sortBlogsByDate";
import { usePageSeoSuppression } from "../../utils/usePageSeoSuppression";
import { GuideCard, GuidesShowcase } from "./Blogs";

const toAbsolute = (base, path = "") => {
  if (!base) return "";
  try {
    return new URL(path || "/", base).toString();
  } catch {
    return "";
  }
};

const AllBlogs = () => {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");
  const isAll = !category || category === "all";
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  usePageSeoSuppression(true);

  const { pageSeo, webinfo } = useLocalContext();
  const { fetchBlogs, fetchBlogsFromCategory, fetchCategoryById } =
    useAdminContext();

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
      try {
        const blogs = isAll
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
  }, [category, isAll, fetchBlogs, fetchBlogsFromCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortOrder, originalPosts]);

  useEffect(() => {
    const fetchSeo = async () => {
      try {
        if (isAll) {
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
  }, [category, isAll, fetchCategoryById]);

  const featured = useMemo(
    () => sortBlogsByDate(originalPosts, "newest").slice(0, 2),
    [originalPosts]
  );

  const morePosts = useMemo(() => {
    const featuredIds = new Set(featured.map((b) => b.id));
    return sortBlogsByDate(
      originalPosts.filter((b) => !featuredIds.has(b.id)),
      sortOrder
    );
  }, [originalPosts, featured, sortOrder]);

  const scrollToMore = () => {
    document
      .getElementById("more-guides")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const handlePagination = (value) => {
    setCurrentPage(value);
    scrollToMore();
  };

  const paginatedPosts = morePosts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(morePosts.length / pageSize) || 1;

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

  const categoryTitle = !isAll && seoTitle ? seoTitle : null;

  const cta = morePosts.length
    ? { label: "More guides", icon: faArrowDown, onClick: scrollToMore }
    : { label: "Browse our fleet", onClick: () => navigate("/fleet") };

  const cardMotion = reduceMotion
    ? { initial: "show", animate: "show" }
    : { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.2 } };

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

      <div className="blogs-page">
        <GuidesShowcase
          className="home-guides--page"
          headingLevel="h1"
          posts={featured}
          loaded={!loading}
          title={categoryTitle}
          cta={!loading && originalPosts.length ? cta : null}
          empty={
            <>
              <p>
                {isAll
                  ? "Guides are on the way. Check back soon."
                  : "Nothing in this category yet. Check back soon or browse all posts."}
              </p>
              {!isAll ? (
                <button
                  type="button"
                  className="home-guides-cta"
                  onClick={() => navigate("/blogs")}
                >
                  View all blogs
                  <FontAwesomeIcon icon={faArrowRight} />
                </button>
              ) : null}
            </>
          }
        />

        {morePosts.length > 0 ? (
          <section
            id="more-guides"
            className="blogs-more"
            aria-labelledby="blogs-more-title"
          >
            <div className="blogs-more-inner">
              <div className="blogs-more-toolbar">
                <div>
                  <h2 id="blogs-more-title">More guides</h2>
                  <p>
                    {morePosts.length} more post{morePosts.length === 1 ? "" : "s"}
                  </p>
                </div>
                <label className="blogs-more-sort">
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

              <div className="blogs-more-grid">
                {paginatedPosts.map((blog, index) => (
                  <GuideCard
                    key={blog.id}
                    blog={blog}
                    index={index}
                    {...cardMotion}
                  />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav className="blogs-more-pagination" aria-label="Pagination">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={currentPage === i + 1 ? "is-active" : ""}
                      aria-current={currentPage === i + 1 ? "page" : undefined}
                      onClick={() => handlePagination(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </nav>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
};

export default AllBlogs;
