import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import api from "../api/http";
import { usePageSeoSuppression } from "../utils/usePageSeoSuppression";
import "../components/TermsAndConditions/TermsAndConditions.css";

export default function CmsPage({ slug: slugProp }) {
  const params = useParams();
  const slug = slugProp || params.slug;
  const [page, setPage] = useState(null);
  const [error, setError] = useState("");
  usePageSeoSuppression(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    api
      .get(`/v1/public/pages/${encodeURIComponent(slug)}`)
      .then(({ data }) => {
        if (!cancelled) setPage(data);
      })
      .catch(() => {
        if (!cancelled) setError("This page is not published yet.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="terms-wrapper">
        <div className="terms-header">
          <h1>Page unavailable</h1>
          <p className="company-subtitle">{error}</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="loader-wrapper">
        <ClipLoader color="#b78a4d" size={72} />
      </div>
    );
  }

  return (
    <div className="terms-wrapper">
      <Helmet>
        <title>{page.seoTitle || page.title}</title>
        <meta name="description" content={page.seoDescription || page.excerpt || ""} />
        {page.seoKeywords ? <meta name="keywords" content={page.seoKeywords} /> : null}
        {page.seoOgImage ? <meta property="og:image" content={page.seoOgImage} /> : null}
        <meta property="og:title" content={page.seoTitle || page.title} />
        <meta property="og:description" content={page.seoDescription || page.excerpt || ""} />
      </Helmet>
      <div className="terms-header">
        <h1>{page.title}</h1>
        <p className="company-subtitle">Dream Drive</p>
      </div>
      <div className="terms-content" dangerouslySetInnerHTML={{ __html: page.body }} />
    </div>
  );
}
