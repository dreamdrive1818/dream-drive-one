import React, { useState, useEffect } from "react";
import api from "../../api/http";
import { uploadToCloudinary } from "../../utils/cloudinaryUpload";
import "./MediaUploader.css";

const MediaUploader = ({ onSelectImage }) => {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [uploadedImages, setUploadedImages] = useState([]);

  // Handle Upload (either file or URL)
  const handleUpload = async () => {
    if ((!image && !imageUrl) || !category) {
      alert("Please select an image, paste a URL, and enter a category.");
      return;
    }

    let url = imageUrl; // Use direct URL if provided

    if (image) {
      url = await uploadToCloudinary(image, { folder: "dreamdrive/media" });
    }

    await api.post("/api/cms/media", { url, category });

    setImage(null);
    setImageUrl("");
    setCategory("");
    fetchImages();
  };

  const fetchImages = async () => {
    const { data } = await api.get("/api/cms/media");
    setUploadedImages(data);
  };

  useEffect(() => {
    fetchImages();
  }, []);

  // Handle Delete
  const handleDelete = async (id, url) => {
    if (window.confirm("Are you sure you want to delete this image?")) {
      await api.delete(`/api/cms/media/${id}`);
      fetchImages();
    }
  };

  return (
    <div className="media-uploader">
      <h2>Upload or Paste Image URL</h2>

      <input type="file" onChange={(e) => setImage(e.target.files[0])} />
      <input
        type="text"
        placeholder="Or paste an image URL here"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
      />
      <input
        type="text"
        placeholder="Enter category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <button onClick={handleUpload}>Upload</button>

      <h3>Uploaded Images</h3>
      <div className="image-gallery">
        {uploadedImages.map((img) => (
          <div key={img.id} className="image-item">
            <img
              src={img.url}
              alt="Uploaded"
              onClick={() => onSelectImage(img.url)}
            />
            <p>{img.category}</p>
            <button className="delete-btn" onClick={() => handleDelete(img.id, img.url)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaUploader;
