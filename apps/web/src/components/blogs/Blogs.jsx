import { useEffect, useRef, useState } from "react";
import "./Blogs.css";
import { useNavigate } from "react-router-dom";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBookOpen,
  faFileLines,
  faMountainSun,
} from "@fortawesome/free-solid-svg-icons";
import { faCalendar, faUser } from "@fortawesome/free-regular-svg-icons";
import api from "../../api/http";
import { useBlogContext } from "../../context/BlogContext";

const FALLBACK_COVERS = [
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
];

const EASE = [0.22, 1, 0.36, 1];

export const revealUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const sceneReveal = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.9, ease: EASE } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

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

function slugFor(blog) {
  const formattedTitle = String(blog.title || "").toLowerCase().replace(/\s+/g, "-");
  return blog.slug || blog.urlSlug || formattedTitle;
}

function categoryFor(blog) {
  return blog.categoryName || blog.category?.name || "";
}

function chipIcon(blog) {
  const text = `${categoryFor(blog)} ${blog.title || ""}`.toLowerCase();
  if (/checklist|tip|guide to|how to/.test(text)) return faFileLines;
  if (/weekend|trip|route|drive|road/.test(text)) return faMountainSun;
  return faBookOpen;
}

export function GuideCard({ blog, index, headingLevel = "h3", ...motionProps }) {
  const { setSelectedUserBlog } = useBlogContext();
  const navigate = useNavigate();
  const category = categoryFor(blog);
  const Title = headingLevel;

  const open = (event) => {
    event.preventDefault();
    setSelectedUserBlog(blog);
    navigate(`/blogs/${slugFor(blog)}`);
  };

  return (
    <motion.a
      href={`/blogs/${slugFor(blog)}`}
      className="home-guides-card"
      variants={revealUp}
      onClick={open}
      {...motionProps}
    >
      <div className="home-guides-media">
        <img src={coverFor(blog, index)} alt="" loading="lazy" />
        {category ? (
          <span className={`home-guides-chip ${index % 2 ? "home-guides-chip--dark" : ""}`}>
            <FontAwesomeIcon icon={chipIcon(blog)} />
            {category}
          </span>
        ) : null}
      </div>
      <div className="home-guides-body">
        <p className="home-guides-meta">
          <span>
            <FontAwesomeIcon icon={faCalendar} />
            {blog.formattedDate}
          </span>
          {blog.author ? (
            <>
              <span className="home-guides-dot" aria-hidden="true">
                •
              </span>
              <span>
                <FontAwesomeIcon icon={faUser} />
                {blog.author}
              </span>
            </>
          ) : null}
        </p>
        <Title className="home-guides-card-title">{blog.title}</Title>
        <p className="home-guides-excerpt">
          {plainText(blog.excerpt || blog.content || blog.body)}
        </p>
        <span className="home-guides-link">
          Read more
          <FontAwesomeIcon icon={faArrowRight} />
        </span>
      </div>
    </motion.a>
  );
}

export function GuidesShowcase({
  posts,
  loaded,
  headingLevel = "h2",
  title,
  lead = "Routes, checklists, and weekend plans for self-drive days out of Ranchi.",
  cta,
  empty,
  className = "",
}) {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.2 });
  const reduceMotion = useReducedMotion();
  const animateState = reduceMotion || inView ? "show" : "hidden";
  const initialState = reduceMotion ? "show" : "hidden";
  const Heading = headingLevel;

  return (
    <section
      ref={sectionRef}
      className={`home-guides ${className}`.trim()}
      aria-labelledby="home-guides-title"
    >
      <div className="home-guides-stage">
        <motion.div
          className="home-guides-scene"
          aria-hidden="true"
          variants={sceneReveal}
          initial={initialState}
          animate={animateState}
        >
          <img
            src="/blogs-road-scene.jpg"
            alt=""
            width="2048"
            height="818"
            loading={headingLevel === "h1" ? "eager" : "lazy"}
            decoding="async"
          />
        </motion.div>

        <motion.div
          className="home-guides-inner"
          variants={stagger}
          initial={initialState}
          animate={animateState}
        >
          <motion.header className="home-guides-header" variants={revealUp}>
            <p className="home-guides-kicker">From the journal</p>
            <Heading id="home-guides-title" className="home-guides-title">
              {title || (
                <>
                  Guides &amp; <span>trip ideas</span>
                </>
              )}
            </Heading>
            {lead ? <p className="home-guides-lead">{lead}</p> : null}
          </motion.header>

          {posts.length > 0 ? (
            <div className="home-guides-grid">
              {posts.slice(0, 2).map((blog, index) => (
                <GuideCard
                  key={blog.id}
                  blog={blog}
                  index={index}
                  headingLevel={headingLevel === "h1" ? "h2" : "h3"}
                />
              ))}
            </div>
          ) : loaded ? (
            <motion.div className="home-guides-empty" variants={revealUp}>
              {empty || "Guides are on the way. Check back soon."}
            </motion.div>
          ) : (
            <div className="home-guides-grid home-guides-grid--placeholder" aria-hidden="true">
              <div className="home-guides-card home-guides-card--ghost" />
              <div className="home-guides-card home-guides-card--ghost" />
            </div>
          )}

          {cta ? (
            <motion.div className="home-guides-footer" variants={revealUp}>
              <button type="button" className="home-guides-cta" onClick={cta.onClick}>
                {cta.label}
                <FontAwesomeIcon icon={cta.icon || faArrowRight} />
              </button>
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}

const Blogs = () => {
  const [blogPosts, setBlogPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);
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
        setBlogPosts(blogData.slice(0, 2));
      } catch {
        setBlogPosts([]);
      } finally {
        setLoaded(true);
      }
    };

    fetchBlogs();
  }, []);

  return (
    <GuidesShowcase
      posts={blogPosts}
      loaded={loaded}
      cta={{ label: "Explore our blogs", onClick: () => navigate("/blogs") }}
    />
  );
};

export default Blogs;
