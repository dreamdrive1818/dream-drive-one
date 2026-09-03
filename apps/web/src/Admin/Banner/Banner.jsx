import React, { useState, useEffect } from 'react';
import api from '../../api/http';
import './Banner.css';
import { toast } from 'react-toastify';

const Banner = () => {
  const [imageCount, setImageCount] = useState(4);
  const [carouselImages, setCarouselImages] = useState([]);

  useEffect(() => {
    setCarouselImages(
      Array.from({ length: imageCount }, () => ({
        name: '',
        file: null,
        link: ''
      }))
    );
  }, [imageCount]);

  const handleInputChange = (index, field, value) => {
    const updated = [...carouselImages];
    updated[index][field] = value;
    if (field === 'link') updated[index].file = null;
    setCarouselImages(updated);
  };

  const handleFileChange = (index, file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const updated = [...carouselImages];
      updated[index].file = reader.result;
      updated[index].link = '';
      setCarouselImages(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      const payload = carouselImages.map((img) => ({
        name: img.name,
        image: img.file || img.link,
      }));
      for (const item of payload) {
        if (!item.image) continue;
        await api.post("/v1/admin/cms/banners", {
          title: item.name || "Hero banner",
          imageUrl: item.image,
          placement: "HERO",
          active: true,
          link: "/fleet",
        });
      }
      toast.success('Carousel saved successfully!');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to save carousel.');
    }
  };

  return (
    <div className="admin-banner">
      <h2>Hero Carousel Banner Setup</h2>

      <div className="form-group">
        <label>Number of Banners</label>
        <input
          type="number"
          min={1}
          max={10}
          value={imageCount}
          onChange={(e) => setImageCount(Number(e.target.value))}
        />
      </div>

      {carouselImages.map((img, index) => (
        <div key={index} className="form-group banner-entry">
          <h4>Banner {index + 1}</h4>
          <input
            type="text"
            placeholder="Banner Name"
            value={img.name}
            onChange={(e) => handleInputChange(index, 'name', e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(index, e.target.files[0])}
          />
          <input
            type="url"
            placeholder="Or paste image URL"
            value={img.link}
            onChange={(e) => handleInputChange(index, 'link', e.target.value)}
          />
        </div>
      ))}

      <button onClick={handleSave} className="save-btn">Save Carousel</button>

      <div className="preview-section">
        <h3>Preview</h3>
        <div className="preview-grid">
       

        </div>
      </div>
    </div>
  );
};

export default Banner;
