import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useBlogContext } from "../../context/BlogContext";
import { ClipLoader } from "react-spinners";
import './Blogpage.css';
import CommentForm from "./CommentForm/CommentForm";
import CommentShow from "./CommentShow/CommentShow";
import RecentBlogs from "./RecentBlogs/RecentBlogs";
import AllCategories from "./AllCategories/AllCategories";

const Blogspage = () => {
  const { slug } = useParams();
  const { selectedBlog, fetchBlogBySlug, loading } = useBlogContext();

  useEffect(() => {
    fetchBlogBySlug(slug);
  }, [slug]);

  if (loading || !selectedBlog) {
    return (
      <div className="loader-wrapper">
        <ClipLoader color="#b78a4d" size={80} />
      </div>
    );
  }

  const injectHeadingIds = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3");
    headings.forEach((heading, index) => {
      heading.id = `heading-${index}`;
    });
    return doc.body.innerHTML;
  };

  const enhancedContent = injectHeadingIds(selectedBlog.content);

  return (
    <>
      <div className="blogpage-wrapper">
        <div className="blogpage-content-container fade-in-bottom">
          <div className="blogpage-header">
            <button className="back-btn" onClick={() => window.history.back()}>← Back</button>
            {/* {selectedBlog.category && (
              <span className="category-tag">
                {selectedBlog.category.toUpperCase()}</span>
            )} */}
            <h1 className="blog-title">{selectedBlog.title}</h1>
            <p className="blog-meta">{selectedBlog.formattedDate} • By {selectedBlog.author}</p>
          </div>

          <div className="blog-toc">
            <h3>📑 Table of Contents</h3>
            <ul>
              {Array.from(new DOMParser().parseFromString(enhancedContent, 'text/html')
                .querySelectorAll('h1, h2, h3')).map((heading, index) => {
                const text = heading.textContent || `Section ${index + 1}`;
                return (
                  <li key={index} className={`toc-${heading.tagName.toLowerCase()}`}>
                    <a href={`#heading-${index}`}>{text}</a>
                  </li>
                );
              })}
            </ul>
          </div>

          {selectedBlog.imageBase64 || selectedBlog.imageLink ? (
            <img
              src={selectedBlog.imageBase64 || selectedBlog.imageLink}
              alt={selectedBlog.title}
              className="blog-cover-image"
            />
          ) : null}

          <div className="blog-body" dangerouslySetInnerHTML={{ __html: enhancedContent }} />
        </div>

        <aside className="blogpage-sidebar">
          <RecentBlogs />
        </aside>
      </div>

      <CommentShow blogId={selectedBlog.id} />
      <CommentForm blogId={selectedBlog.id} blogTitle={selectedBlog.title} />
      {/* <RecentBlogs /> */}
    </>
  );
};

export default Blogspage;
