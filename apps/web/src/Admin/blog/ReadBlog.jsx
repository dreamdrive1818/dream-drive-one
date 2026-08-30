import React, { useEffect, useState } from 'react';
import './ReadBlog.css';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/http';

const ReadBlog = () => {
  const { title } = useParams();
  const navigate = useNavigate();
  const decodedTitle = decodeURIComponent(title); // Decode back

  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const { data: blogs } = await api.get('/api/cms/legacy-blogs');
  
        console.log("Fetched blogs:", blogs.map(b => b.title)); // Debugging
        console.log("Decoded title from URL:", decodedTitle); // Debugging
  
        // Normalize title to avoid space or case mismatches
        const matchedBlog = blogs.find(blog => 
          blog.title.trim().toLowerCase() === decodedTitle.trim().toLowerCase()
        );
  
        if (matchedBlog) {
          setBlog(matchedBlog);
        } else {
          console.warn("No matching blog found.");
        }
      } catch (error) {
        console.error('Error fetching blog:', error);
      }
    };
  
    fetchBlog();
  }, [decodedTitle]);
  
  

  if (loading) return <p>Loading...</p>;
  if (!blog) return <p className="no-blog">No blog found.</p>;

  return (
    <div className="read-blog-container">
      <button className="back-btn" onClick={() => navigate('/admin/blog')}>← Back</button>
      <h1 className="blog-title">{blog.title}</h1>
      <p className="blog-date"><strong>Published on:</strong> {blog.formattedDate}</p>
      <p className="blog-category"><strong>Category:</strong> {blog.category}</p>

      {blog.imageBase64 && (
        <img src={blog.imageBase64} alt="Blog" className="blog-image" />
      )}

      <div className="blog-content" dangerouslySetInnerHTML={{ __html: blog.content }} />
    </div>
  );
};

export default ReadBlog;
