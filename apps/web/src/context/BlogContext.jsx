import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/http";

const BlogContext = createContext();

export const BlogProvider = ({ children }) => {
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedUserBlog, setSelectedUserBlog] = useState(() => {
    const saved = localStorage.getItem("selectedBlog");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem("selectedBlog", JSON.stringify(selectedUserBlog));
  }, [selectedUserBlog]);

  const fetchBlogBySlug = async (slug) => {
    if (!slug) {
      console.warn("fetchBlogBySlug called with undefined slug");
      setSelectedBlog(null);
      return null;
    }

    setLoading(true);
    try {
      const { data } = await api.get(`/api/cms/blogs/slug/${encodeURIComponent(slug)}`);
      if (data?.id) {
        const blog = {
          id: data.id,
          title: data.title,
          content: data.content,
          author: data.author,
          imageBase64: data.imageBase64,
          imageLink: data.imageLink,
          formattedDate: data.createdAt?.seconds
            ? new Date(data.createdAt.seconds * 1000).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "Date not available",
          createdAt: data.createdAt,
          urlSlug: data.urlSlug,
          category: data.category,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          seoKeywords: data.seoKeywords,
        };

        setSelectedBlog(blog);
        updateMetaTags(blog);
        return blog;
      } else {
        console.warn("No blog found with slug:", slug);
        setSelectedBlog(null);
        return null;
      }
    } catch (err) {
      console.error("Error fetching blog by slug:", err);
      setSelectedBlog(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateMetaTags = (blog) => {
    document.title = blog.seoTitle || blog.title;

    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = document.createElement("meta");
      desc.name = "description";
      document.head.appendChild(desc);
    }
    desc.content = blog.seoDescription || "Default blog description";

    let keywords = document.querySelector('meta[name="keywords"]');
    if (!keywords) {
      keywords = document.createElement("meta");
      keywords.name = "keywords";
      document.head.appendChild(keywords);
    }
    keywords.content = Array.isArray(blog.seoKeywords)
      ? blog.seoKeywords.join(", ")
      : blog.seoKeywords || "blog, antivirus, cybersecurity";
  };

  return (
    <BlogContext.Provider
      value={{
        blogs,
        selectedBlog,
        loading,
        fetchBlogBySlug,
        selectedUserBlog,
        setSelectedUserBlog,
      }}
    >
      {children}
    </BlogContext.Provider>
  );
};

export const useBlogContext = () => useContext(BlogContext);
