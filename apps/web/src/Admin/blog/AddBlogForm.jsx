import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './AddBlogForm.css';
import { useAdminContext } from '../../context/AdminContext';

const AddBlogForm = ({ onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [author, setAuthor] = useState('');
  const [imageLink, setImageLink] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { fetchCategories, addBlog } = useAdminContext();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (err) {
        console.error('Failed to load categories:', err);
        toast.error('Failed to load categories');
      }
    };
    loadCategories();
  }, [fetchCategories]);

  const formatTitleForURL = (title) => {
    return title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result);
      };
      reader.readAsDataURL(file);
      setImage(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a blog title');
      return;
    }

    if (!imageBase64 && !imageLink) {
      toast.error('Please upload an image or provide an image URL');
      return;
    }

    if (!category) {
      toast.error('Please select a category');
      return;
    }

    setIsSubmitting(true);

    const formattedTitle = formatTitleForURL(title);

    const blogData = {
      title,
      content,
      imageBase64,
      imageLink,
      category,
      createdAt: new Date(),
      formattedDate: new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      author,
      urlSlug: formattedTitle,
      seoTitle,
      seoDescription,
      seoKeywords: seoKeywords.split(',').map(k => k.trim()).filter(k => k),
    };

    try {
      await addBlog(blogData);
      toast.success('Blog added successfully!');
      // Reset form
      setTitle('');
      setContent('');
      setImage(null);
      setImageBase64('');
      setCategory('');
      setDate('');
      setAuthor('');
      setImageLink('');
      setSeoTitle('');
      setSeoDescription('');
      setSeoKeywords('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error('Error uploading blog: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="addblog">
      <button className="close" onClick={onClose} aria-label="Close form">X</button>
      <div className="addblog-form">
        <h2>Add a Blog</h2>
        <form onSubmit={handleSubmit} className="blog-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter blog title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Content</label>
            <ReactQuill
              value={content}
              onChange={setContent}
              theme="snow"
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
                'header',
                'bold', 'italic', 'underline', 'strike',
                'color', 'background',
                'align',
                'blockquote', 'code-block',
                'list', 'bullet',
                'link', 'image', 'video'
              ]}
              style={{ minHeight: '200px', marginBottom: '1rem' }}
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
              <option value="">Select a Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="image">Upload Image</label>
            <input
              type="file"
              id="image"
              onChange={handleImageChange}
              accept="image/*"
            />
          </div>

          <div className="form-group">
            <label htmlFor="imageLink">Or Image URL</label>
            <input
              type="url"
              id="imageLink"
              value={imageLink}
              onChange={(e) => setImageLink(e.target.value)}
              placeholder="Enter image URL"
            />
          </div>

          {(imageBase64 || imageLink) && (
            <img
              src={imageBase64 || imageLink}
              alt="Preview"
              className="image-preview"
            />
          )}

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

          <h3>SEO Settings</h3>

          <div className="form-group">
            <label htmlFor="seoTitle">SEO Title</label>
            <input
              type="text"
              id="seoTitle"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="SEO title"
            />
          </div>

          <div className="form-group">
            <label htmlFor="seoDescription">SEO Description</label>
            <input
              type="text"
              id="seoDescription"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="SEO description"
            />
          </div>

          <div className="form-group">
            <label htmlFor="seoKeywords">SEO Keywords</label>
            <input
              type="text"
              id="seoKeywords"
              value={seoKeywords}
              onChange={(e) => setSeoKeywords(e.target.value)}
              placeholder="e.g. antivirus, windows, printer"
            />
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Add Blog'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddBlogForm;
