import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useAdminContext } from '../../context/AdminContext';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './BlogEditForm.css';

const slugify = (str) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

const BlogEditForm = () => {
  const navigate = useNavigate();
  const { selectedBlog, fetchCategories, updateBlog } = useAdminContext();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageLink, setImageLink] = useState('');
  const [author, setAuthor] = useState('');
  const [date, setDate] = useState('');
  const [urlSlug, setUrlSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (selectedBlog) {
      setTitle(selectedBlog.title || '');
      setContent(selectedBlog.content || '');
      setCategory(selectedBlog.category || '');
      setImageBase64(selectedBlog.imageBase64 || '');
      setImageLink(selectedBlog.imageLink || '');
      setAuthor(selectedBlog.author || '');
      setDate(selectedBlog.date || '');
      setUrlSlug(selectedBlog.urlSlug || '');
      setSeoTitle(selectedBlog.seoTitle || '');
      setSeoDescription(selectedBlog.seoDescription || '');
      setSeoKeywords(selectedBlog.seoKeywords || '');
    }
  }, [selectedBlog]);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setUrlSlug(slugify(newTitle));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content || !category || !author || !date || !urlSlug) {
      toast.error('All fields are required!');
      return;
    }

    try {
   await updateBlog(
  selectedBlog.id,
  {
    title,
    content,
    category,
    imageBase64,
    imageLink,
    author,
    date,
    urlSlug,
    seoTitle,
    seoDescription,
    seoKeywords,
  },
  category
);

      toast.success('Blog updated successfully!');
      navigate('/admin/blog');
    } catch (error) {
      toast.error('Error updating blog: ' + error.message);
    }
  };

  const handleBackClick = () => {
    navigate('/admin/blog');
  };

  return (
    <div className="editblog">
      <div className="editblog-form">
        <button onClick={handleBackClick} className="back-btn">Back to Blog List</button>
        <h2>Edit Blog</h2>
        <form onSubmit={handleSubmit} className="blog-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={handleTitleChange}
              placeholder="Enter blog title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Content</label>
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              modules={{
                toolbar: [
                  [{ header: [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ color: [] }, { background: [] }],
                  [{ align: [] }],
                  ['blockquote', 'code-block'],
                  [{ list: 'ordered' }, { list: 'bullet' }],
                  ['link', 'image', 'video'],
                  ['clean']
                ]
              }}
              formats={[
                'header', 'bold', 'italic', 'underline', 'strike',
                'color', 'background', 'align', 'blockquote', 'code-block',
                'list', 'bullet', 'link', 'image', 'video'
              ]}
              style={{ minHeight: '200px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="imageLink">Image URL (optional)</label>
            <input
              type="url"
              id="imageLink"
              value={imageLink}
              onChange={(e) => setImageLink(e.target.value)}
              placeholder="Enter image URL"
            />
          </div>

          <div className="form-group">
            <label htmlFor="author">Author</label>
            <input
              type="text"
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Enter author name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">Blog Image</label>
            <input
              type="file"
              id="image"
              onChange={handleImageChange}
              accept="image/*"
            />
          </div>

          {imageBase64 && <img src={imageBase64} alt="Preview" className="image-preview" />}
          {!imageBase64 && imageLink && <img src={imageLink} alt="Preview" className="image-preview" />}

          <h3>SEO Fields ↓</h3>

          <div className="form-group">
            <label htmlFor="seoTitle">SEO Title</label>
            <input
              type="text"
              id="seoTitle"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="Enter SEO Title"
            />
          </div>

          <div className="form-group">
            <label htmlFor="seoDescription">SEO Description</label>
            <input
              type="text"
              id="seoDescription"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="Enter SEO Description"
            />
          </div>

          <div className="form-group">
            <label htmlFor="seoKeywords">SEO Keywords (comma separated)</label>
            <input
              type="text"
              id="seoKeywords"
              value={seoKeywords}
              onChange={(e) => setSeoKeywords(e.target.value)}
              placeholder="Enter SEO Keywords"
            />
          </div>

          <button type="submit" className="submit-btn">Update Blog</button>
        </form>
      </div>
    </div>
  );
};

export default BlogEditForm;
