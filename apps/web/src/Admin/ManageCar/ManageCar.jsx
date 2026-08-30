import React, { useEffect, useRef, useState } from "react";
import "./ManageCar.css";
import { useAdminContext } from "../../context/AdminContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPenToSquare,
  faTrash,
  faXmark,
  faCarSide,
  faTag,
  faImage,
  faListUl,
  faChevronLeft,
  faCloudArrowUp,
  faSpinner,
  faCheck,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";
import {
  ensureCloudinaryImages,
  isCloudinaryUrl,
  isHttpUrl,
  uploadToCloudinary,
} from "../../utils/cloudinaryUpload";

const EMPTY_FORM = {
  name: "",
  price: "",
  salePrice: "",
  available: "Available",
  displayOrder: 1,
  images: [""],
  twelveHrWeekday: "",
  twentyFourHrWeekday: "",
  twentyFourHrWeekend: "",
  securityDeposit: "",
  details: {
    kilometer: "",
    extraKm: "",
    extraHr: "",
    type: "",
    seats: "",
    luggage: "",
    fuel: "",
    mt: "",
  },
};

const DETAIL_FIELDS = [
  { key: "kilometer", label: "Kilometer" },
  { key: "extraKm", label: "Extra Km" },
  { key: "extraHr", label: "Extra Hour" },
  { key: "type", label: "Type" },
  { key: "seats", label: "Seats" },
  { key: "luggage", label: "Luggage" },
  { key: "fuel", label: "Fuel" },
  { key: "mt", label: "Transmission" },
];

const PANEL_SECTIONS = [
  {
    id: "basic",
    label: "Basic info",
    hint: "Name & availability",
    icon: faCarSide,
  },
  {
    id: "pricing",
    label: "Pricing",
    hint: "Rates & deposit",
    icon: faTag,
  },
  {
    id: "images",
    label: "Images",
    hint: "Gallery & Cloudinary",
    icon: faImage,
  },
  {
    id: "specs",
    label: "Specifications",
    hint: "Vehicle details",
    icon: faListUl,
  },
];

const ManageCar = () => {
  const { fetchCars, addCar, updateCar, deleteCar } = useAdminContext();

  const [cars, setCars] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [activeSection, setActiveSection] = useState("basic");
  const [editCarId, setEditCarId] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState({});
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [imageStatus, setImageStatus] = useState({});
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateProgress, setMigrateProgress] = useState("");
  const fileInputRef = useRef(null);

  const loadCars = async () => {
    const carList = await fetchCars();
    const sorted = carList
      .filter((car) => car.displayOrder !== undefined)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    setCars(sorted);
    const indexMap = {};
    sorted.forEach((car) => (indexMap[car.id] = 0));
    setCarouselIndex(indexMap);
  };

  useEffect(() => {
    loadCars();
  }, []);

  const openPanel = () => {
    setActiveSection("basic");
    setPanelOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelVisible(true));
    });
  };

  const closePanel = () => {
    setPanelVisible(false);
    setTimeout(() => {
      setPanelOpen(false);
      setActiveSection("basic");
      resetForm();
    }, 320);
  };

  const sectionIndex = PANEL_SECTIONS.findIndex((s) => s.id === activeSection);
  const goPrevSection = () => {
    if (sectionIndex > 0) setActiveSection(PANEL_SECTIONS[sectionIndex - 1].id);
  };
  const goNextSection = () => {
    if (sectionIndex < PANEL_SECTIONS.length - 1) {
      setActiveSection(PANEL_SECTIONS[sectionIndex + 1].id);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name in formData.details) {
      setFormData((prev) => ({
        ...prev,
        details: { ...prev.details, [name]: value },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: name === "displayOrder" ? parseInt(value) || 0 : value,
      }));
    }
  };

  const setImageAt = (index, value) => {
    setFormData((prev) => {
      const updatedImages = [...prev.images];
      updatedImages[index] = value;
      return { ...prev, images: updatedImages };
    });
  };

  const handleImageChange = (index, value) => {
    setImageAt(index, value);
    setImageStatus((prev) => ({ ...prev, [index]: "" }));
  };

  const uploadImageAtIndex = async (index, source) => {
    const value = typeof source === "string" ? source.trim() : source;
    if (!value) return null;

    if (typeof value === "string" && isCloudinaryUrl(value)) {
      setImageStatus((prev) => ({ ...prev, [index]: "ready" }));
      return value;
    }

    setImageStatus((prev) => ({ ...prev, [index]: "uploading" }));
    try {
      const cloudUrl = await uploadToCloudinary(value);
      setImageAt(index, cloudUrl);
      setImageStatus((prev) => ({ ...prev, [index]: "ready" }));
      return cloudUrl;
    } catch (err) {
      console.error(err);
      setImageStatus((prev) => ({ ...prev, [index]: "error" }));
      alert(err.message || "Failed to upload image to Cloudinary.");
      return null;
    }
  };

  const handleImageBlur = async (index) => {
    const url = formData.images[index]?.trim();
    if (!url || isCloudinaryUrl(url) || !isHttpUrl(url)) return;
    await uploadImageAtIndex(index, url);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    let working = [...formData.images];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is larger than 5 MB and was skipped.`);
        continue;
      }

      let slot = working.findIndex((img) => !String(img || "").trim());
      if (slot === -1) {
        working = [...working, ""];
        slot = working.length - 1;
      }

      setFormData((prev) => {
        const next = [...prev.images];
        while (next.length <= slot) next.push("");
        next[slot] = "Uploading…";
        return { ...prev, images: next };
      });
      setImageStatus((prev) => ({ ...prev, [slot]: "uploading" }));

      try {
        const cloudUrl = await uploadToCloudinary(file);
        working[slot] = cloudUrl;
        setFormData((prev) => {
          const next = [...prev.images];
          while (next.length <= slot) next.push("");
          next[slot] = cloudUrl;
          return { ...prev, images: next };
        });
        setImageStatus((prev) => ({ ...prev, [slot]: "ready" }));
      } catch (err) {
        console.error(err);
        working[slot] = "";
        setFormData((prev) => {
          const next = [...prev.images];
          while (next.length <= slot) next.push("");
          next[slot] = "";
          return { ...prev, images: next };
        });
        setImageStatus((prev) => ({ ...prev, [slot]: "error" }));
        alert(err.message || `Failed to upload ${file.name}`);
      }
    }
  };

  const addImageField = () => {
    setFormData((prev) => ({ ...prev, images: [...prev.images, ""] }));
  };

  const removeImageField = (index) => {
    setFormData((prev) => {
      const updatedImages = prev.images.filter((_, i) => i !== index);
      return {
        ...prev,
        images: updatedImages.length ? updatedImages : [""],
      };
    });
    setImageStatus((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        const k = Number(key);
        if (k < index) next[k] = prev[k];
        if (k > index) next[k - 1] = prev[k];
      });
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      return alert("Car name and starting price are required.");
    }

    setSaving(true);
    try {
      const cloudImages = await ensureCloudinaryImages(formData.images);
      const cleaned = cloudImages.filter((url) => isCloudinaryUrl(url));
      if (!cleaned.length) {
        alert("At least one Cloudinary image is required.");
        setSaving(false);
        return;
      }

      const payload = { ...formData, images: cleaned };

      if (editCarId) {
        await updateCar(editCarId, payload);
      } else {
        await addCar(payload);
      }

      closePanel();
      loadCars();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to save car.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditCarId(null);
    setImageStatus({});
    setSaving(false);
  };

  const handleAdd = () => {
    resetForm();
    openPanel();
  };

  const handleEdit = (car) => {
    const images = car.images?.length ? car.images : [""];
    setFormData({
      ...EMPTY_FORM,
      ...car,
      images,
      available: car.available || "Available",
      salePrice: car.salePrice || "",
      twelveHrWeekday: car.twelveHrWeekday || "",
      twentyFourHrWeekday: car.twentyFourHrWeekday || "",
      twentyFourHrWeekend: car.twentyFourHrWeekend || "",
      securityDeposit: car.securityDeposit || "",
      details: { ...EMPTY_FORM.details, ...(car.details || {}) },
    });
    const statusMap = {};
    images.forEach((url, i) => {
      if (isCloudinaryUrl(url)) statusMap[i] = "ready";
      else if (isHttpUrl(url)) statusMap[i] = "external";
    });
    setImageStatus(statusMap);
    setEditCarId(car.id);
    openPanel();
  };

  const handleDelete = async (id) => {
    await deleteCar(id);
    loadCars();
  };

  const countExternalImages = (carList = cars) =>
    carList.reduce((total, car) => {
      const images = Array.isArray(car.images) ? car.images : [];
      return (
        total +
        images.filter((url) => isHttpUrl(url) && !isCloudinaryUrl(url)).length
      );
    }, 0);

  const migrateExistingCars = async () => {
    const externalCount = countExternalImages();
    if (!externalCount) {
      alert("All car images are already on Cloudinary.");
      return;
    }

    const ok = window.confirm(
      `Upload ${externalCount} external image(s) to Cloudinary and update existing cars?`
    );
    if (!ok) return;

    setMigrating(true);
    setMigrateProgress("Starting…");

    try {
      let migrated = 0;
      for (let i = 0; i < cars.length; i += 1) {
        const car = cars[i];
        const images = Array.isArray(car.images) ? car.images : [];
        const needsMigration = images.some(
          (url) => isHttpUrl(url) && !isCloudinaryUrl(url)
        );
        if (!needsMigration) continue;

        setMigrateProgress(`Migrating ${car.name || car.id} (${i + 1}/${cars.length})…`);
        const cloudImages = await ensureCloudinaryImages(images);
        const cleaned = cloudImages.filter((url) => isCloudinaryUrl(url));
        if (!cleaned.length) continue;

        const { id, ...rest } = car;
        await updateCar(id, { ...rest, images: cleaned });
        migrated += 1;
      }

      await loadCars();
      setMigrateProgress("");
      alert(`Migration complete. Updated ${migrated} car(s).`);
    } catch (err) {
      console.error(err);
      alert(err.message || "Migration failed.");
    } finally {
      setMigrating(false);
      setMigrateProgress("");
    }
  };

  const handlePrev = (id) => {
    setCarouselIndex((prev) => ({
      ...prev,
      [id]:
        prev[id] === 0
          ? (cars.find((car) => car.id === id)?.images?.length || 1) - 1
          : prev[id] - 1,
    }));
  };

  const handleNext = (id) => {
    setCarouselIndex((prev) => ({
      ...prev,
      [id]: (prev[id] + 1) % (cars.find((car) => car.id === id)?.images?.length || 1),
    }));
  };

  const handleThumbClick = (carId, index) => {
    setCarouselIndex((prev) => ({ ...prev, [carId]: index }));
  };

  useEffect(() => {
    if (!panelOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closePanel();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [panelOpen]);

  const externalFleetCount = countExternalImages();

  return (
    <div className="manage-car-container">
      <div className="manage-car-header">
        <div>
          <h2>Manage Fleet</h2>
          <p className="manage-car-sub">Add, edit, and organize cars in your fleet.</p>
        </div>
        <div className="manage-car-header-actions">
          {externalFleetCount > 0 && (
            <button
              type="button"
              className="migrate-btn"
              onClick={migrateExistingCars}
              disabled={migrating}
            >
              <FontAwesomeIcon icon={migrating ? faSpinner : faCloudArrowUp} spin={migrating} />
              {migrating
                ? migrateProgress || "Migrating…"
                : `Migrate ${externalFleetCount} image(s) to Cloudinary`}
            </button>
          )}
          <button type="button" className="add-btn" onClick={handleAdd}>
            <FontAwesomeIcon icon={faPlus} />
            Add Car
          </button>
        </div>
      </div>

      <div className="car-list">
        {cars.map((car) => {
          const hasExternal = (car.images || []).some(
            (url) => isHttpUrl(url) && !isCloudinaryUrl(url)
          );
          return (
            <div key={car.id} className="car-card">
              <div className="carousel-container">
                <button type="button" className="arrow left" onClick={() => handlePrev(car.id)}>
                  &#8249;
                </button>
                <img
                  src={car.images?.[carouselIndex[car.id] || 0]}
                  alt={car.name || "car"}
                  className="carousel-image"
                />
                <button type="button" className="arrow right" onClick={() => handleNext(car.id)}>
                  &#8250;
                </button>
                {hasExternal && <span className="car-external-badge">External images</span>}
              </div>
              <div className="thumbnails">
                {car.images?.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt="thumb"
                    className={`thumb ${carouselIndex[car.id] === index ? "active" : ""}`}
                    onClick={() => handleThumbClick(car.id, index)}
                  />
                ))}
              </div>
              <h4>{car.name}</h4>
              <p>
                Starting Price :{" "}
                {car.salePrice ? (
                  <>
                    <span style={{ textDecoration: "line-through", opacity: 0.7, marginRight: 6 }}>
                      ₹{car.salePrice}
                    </span>
                    ₹{car.price}
                  </>
                ) : (
                  <>₹{car.price}</>
                )}
              </p>
              <p>{car.details?.type}</p>
              <p>Display Order: {car.displayOrder}</p>
              <p>
                Availability: <strong>{car.available}</strong>
              </p>
              <p>12 Hr Weekday: ₹{car.twelveHrWeekday}</p>
              <p>24 Hr Weekday: ₹{car.twentyFourHrWeekday}</p>
              <p>24 Hr Weekend: ₹{car.twentyFourHrWeekend}</p>
              <p>Security Deposit: ₹{car.securityDeposit}</p>
              <div className="car-actions">
                <button type="button" onClick={() => handleEdit(car)}>
                  <FontAwesomeIcon icon={faPenToSquare} /> Edit
                </button>
                <button type="button" onClick={() => handleDelete(car.id)}>
                  <FontAwesomeIcon icon={faTrash} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {panelOpen && (
        <div
          className={`car-drawer-overlay ${panelVisible ? "is-open" : ""}`}
          onClick={closePanel}
          role="presentation"
        >
          <aside
            className={`car-drawer ${panelVisible ? "is-open" : ""}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="car-drawer-title"
          >
            <header className="car-drawer-nav">
              <button type="button" className="car-drawer-back" onClick={closePanel}>
                <FontAwesomeIcon icon={faChevronLeft} />
                <span>Fleet</span>
              </button>
              <div className="car-drawer-nav-center">
                <p className="car-drawer-crumb">
                  Admin / Cars / {editCarId ? "Edit" : "Add"}
                </p>
                <h3 id="car-drawer-title">
                  <FontAwesomeIcon icon={editCarId ? faPenToSquare : faCarSide} />
                  {editCarId ? "Edit Car" : "Add Car"}
                </h3>
              </div>
              <button
                type="button"
                className="car-drawer-close"
                onClick={closePanel}
                aria-label="Close panel"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>

            <div className="car-drawer-workspace">
              <nav className="car-drawer-sidenav" aria-label="Form sections">
                <p className="car-drawer-sidenav-label">Sections</p>
                <ul className="car-drawer-sidenav-list">
                  {PANEL_SECTIONS.map((section, index) => (
                    <li key={section.id}>
                      <button
                        type="button"
                        className={`car-drawer-sidenav-item ${
                          activeSection === section.id ? "active" : ""
                        }`}
                        onClick={() => setActiveSection(section.id)}
                      >
                        <span className="car-drawer-sidenav-index">{index + 1}</span>
                        <span className="car-drawer-sidenav-icon">
                          <FontAwesomeIcon icon={section.icon} />
                        </span>
                        <span className="car-drawer-sidenav-text">
                          <strong>{section.label}</strong>
                          <small>{section.hint}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="car-drawer-body">
                {activeSection === "basic" && (
                  <section className="car-drawer-section" key="basic">
                    <div className="car-drawer-section-head">
                      <FontAwesomeIcon icon={faCarSide} />
                      <div>
                        <h4>Basic info</h4>
                        <p>Name, availability, and listing order</p>
                      </div>
                    </div>
                    <div className="car-drawer-grid">
                      <div className="car-field full">
                        <label htmlFor="carName">Car Name</label>
                        <input
                          id="carName"
                          type="text"
                          name="name"
                          placeholder="e.g. Toyota Innova Crysta"
                          value={formData.name}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="car-field">
                        <label htmlFor="displayOrder">Display Position</label>
                        <input
                          id="displayOrder"
                          type="number"
                          name="displayOrder"
                          placeholder="e.g. 1"
                          value={formData.displayOrder}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="car-field">
                        <label htmlFor="availability">Availability</label>
                        <select
                          id="availability"
                          name="available"
                          value={formData.available}
                          onChange={handleInputChange}
                          className="availability-dropdown"
                        >
                          <option value="Available">Available</option>
                          <option value="Not Available">Not Available</option>
                        </select>
                      </div>
                    </div>
                  </section>
                )}

                {activeSection === "pricing" && (
                  <section className="car-drawer-section" key="pricing">
                    <div className="car-drawer-section-head">
                      <FontAwesomeIcon icon={faTag} />
                      <div>
                        <h4>Pricing</h4>
                        <p>Base rates, packages, and deposit</p>
                      </div>
                    </div>
                    <div className="car-drawer-grid">
                      <div className="car-field">
                        <label htmlFor="carSalePrice">Sale Price (₹)</label>
                        <input
                          id="carSalePrice"
                          type="text"
                          name="salePrice"
                          placeholder="e.g. 2999"
                          value={formData.salePrice}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="car-field">
                        <label htmlFor="carPrice">Discounted Price (₹)</label>
                        <input
                          id="carPrice"
                          type="text"
                          name="price"
                          placeholder="e.g. 2499"
                          value={formData.price}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="car-field">
                        <label htmlFor="twelveHrWeekday">12 Hr Weekday (₹)</label>
                        <input
                          id="twelveHrWeekday"
                          type="text"
                          name="twelveHrWeekday"
                          placeholder="Enter price"
                          value={formData.twelveHrWeekday}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="car-field">
                        <label htmlFor="twentyFourHrWeekday">24 Hr Weekday (₹)</label>
                        <input
                          id="twentyFourHrWeekday"
                          type="text"
                          name="twentyFourHrWeekday"
                          placeholder="Enter price"
                          value={formData.twentyFourHrWeekday}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="car-field">
                        <label htmlFor="twentyFourHrWeekend">24 Hr Weekend (₹)</label>
                        <input
                          id="twentyFourHrWeekend"
                          type="text"
                          name="twentyFourHrWeekend"
                          placeholder="Enter price"
                          value={formData.twentyFourHrWeekend}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="car-field">
                        <label htmlFor="securityDeposit">Security Deposit (₹)</label>
                        <input
                          id="securityDeposit"
                          type="text"
                          name="securityDeposit"
                          placeholder="Enter deposit"
                          value={formData.securityDeposit}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </section>
                )}

                {activeSection === "images" && (
                  <section className="car-drawer-section" key="images">
                    <div className="car-drawer-section-head">
                      <FontAwesomeIcon icon={faImage} />
                      <div>
                        <h4>Images</h4>
                        <p>
                          Paste an external link or upload a file — images are stored on
                          Cloudinary.
                        </p>
                      </div>
                    </div>

                    <div className="car-image-toolbar">
                      <button
                        type="button"
                        className="upload-file-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FontAwesomeIcon icon={faUpload} />
                        Upload from device
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={handleFileUpload}
                      />
                      <span className="car-image-hint">
                        External links auto-upload to Cloudinary on blur / save.
                      </span>
                    </div>

                    <div className="car-image-preview-grid">
                      {formData.images.map((img, index) => {
                        const url = String(img || "").trim();
                        const showPreview =
                          isHttpUrl(url) || isCloudinaryUrl(url);
                        const status = imageStatus[index];
                        return (
                          <div key={index} className="car-image-preview-card">
                            <div className="car-image-preview-frame">
                              {showPreview ? (
                                <img
                                  src={url}
                                  alt={`Preview ${index + 1}`}
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="car-image-preview-empty">
                                  <FontAwesomeIcon icon={faImage} />
                                  <span>No preview</span>
                                </div>
                              )}
                              {status === "uploading" && (
                                <div className="car-image-preview-overlay">
                                  <FontAwesomeIcon icon={faSpinner} spin />
                                  Uploading…
                                </div>
                              )}
                            </div>

                            <div className="car-image-row">
                              <input
                                type="text"
                                placeholder={`Image URL ${index + 1}`}
                                value={url === "Uploading…" ? "" : img}
                                onChange={(e) => handleImageChange(index, e.target.value)}
                                onBlur={() => handleImageBlur(index)}
                                disabled={status === "uploading"}
                              />
                              <button
                                type="button"
                                onClick={() => removeImageField(index)}
                                className="remove-img"
                                aria-label="Remove image"
                              >
                                <FontAwesomeIcon icon={faXmark} />
                              </button>
                            </div>

                            <div className="car-image-meta">
                              {isCloudinaryUrl(url) && (
                                <span className="car-image-badge ready">
                                  <FontAwesomeIcon icon={faCheck} /> Cloudinary
                                </span>
                              )}
                              {isHttpUrl(url) && !isCloudinaryUrl(url) && status !== "uploading" && (
                                <button
                                  type="button"
                                  className="car-image-badge external"
                                  onClick={() => uploadImageAtIndex(index, url)}
                                >
                                  <FontAwesomeIcon icon={faCloudArrowUp} />
                                  Upload to Cloudinary
                                </button>
                              )}
                              {status === "error" && (
                                <span className="car-image-badge error">Upload failed</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button type="button" onClick={addImageField} className="add-img-btn">
                      <FontAwesomeIcon icon={faPlus} />
                      Add Image Field
                    </button>
                  </section>
                )}

                {activeSection === "specs" && (
                  <section className="car-drawer-section" key="specs">
                    <div className="car-drawer-section-head">
                      <FontAwesomeIcon icon={faListUl} />
                      <div>
                        <h4>Specifications</h4>
                        <p>Vehicle details shown to customers</p>
                      </div>
                    </div>
                    <div className="car-drawer-grid">
                      {DETAIL_FIELDS.map(({ key, label }) => (
                        <div key={key} className="car-field">
                          <label htmlFor={key}>{label}</label>
                          <input
                            id={key}
                            type="text"
                            name={key}
                            placeholder={`Enter ${label.toLowerCase()}`}
                            value={formData.details[key]}
                            onChange={handleInputChange}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <footer className="car-drawer-footer">
              <div className="car-drawer-footer-nav">
                <button
                  type="button"
                  className="car-drawer-step"
                  onClick={goPrevSection}
                  disabled={sectionIndex <= 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="car-drawer-step"
                  onClick={goNextSection}
                  disabled={sectionIndex >= PANEL_SECTIONS.length - 1}
                >
                  Next
                </button>
              </div>
              <div className="car-drawer-footer-actions">
                <button type="button" className="car-drawer-cancel" onClick={closePanel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="car-drawer-save"
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin /> Saving…
                    </>
                  ) : editCarId ? (
                    "Update Car"
                  ) : (
                    "Add Car"
                  )}
                </button>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
};

export default ManageCar;
