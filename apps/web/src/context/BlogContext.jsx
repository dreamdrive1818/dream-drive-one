import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/http";

const BlogContext = createContext();

export const BlogProvider = ({ children }) => {
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedUserBlog, setSelectedUserBlog] = useState(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("selectedBlog");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("selectedBlog", JSON.stringify(selectedUserBlog));
  }, [selectedUserBlog]);

  const fetchBlogBySlug = async (slug) => {
    if (!slug) {
      setSelectedBlog(null);
      return null;
    }

    setLoading(true);
    try {
      const { data } = await api.get(`/v1/public/blogs/${encodeURIComponent(slug)}`);
      if (data?.id) {
        setSelectedBlog(data);
        document.title = data.seoTitle || data.title;
        return data;
      }
      setSelectedBlog(null);
      return null;
    } catch (err) {
      console.error("Error fetching blog by slug:", err);
      setSelectedBlog(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlogContext.Provider
      value={{
        blogs,
        setBlogs,
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
