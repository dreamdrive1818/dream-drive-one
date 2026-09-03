import React, { useEffect, useState } from "react";
import api from "../../../api/http";
import "./CommentShow.css";

const CommentShow = ({ blogId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    try {
      const { data } = await api.get(`/v1/public/blogs/${encodeURIComponent(blogId)}/comments`);
      setComments((data || []).filter((comment) => comment.approved !== false));
    } catch (err) {
      console.error("Error loading comments:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (blogId) {
      fetchComments();
    }
  }, [blogId]);

  if (loading) return <div className="comment-section"><p className="comment-loading">Loading comments...</p></div>;
  if (comments.length === 0) return <p className="comment-none">No comments yet.</p>;

  return (
    <div className="comment-section">
      <h3 className="comment-title">Comments</h3>
      {comments.map((comment, index) => (
        <div className="comment-box" key={index}>
          <p className="comment-text">“{comment.comment || comment.body}”</p>
          <p className="comment-meta">— {comment.name}</p>
        </div>
      ))}
    </div>
  );
};

export default CommentShow;
