import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import api from "../../api/http";
import { usePageSeoSuppression } from "../../utils/usePageSeoSuppression";
import { LegalSkeleton } from "../Skeleton/Skeleton";
import "../TermsAndConditions/TermsAndConditions.css";

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
      <section className="legal-page">
        <div className="legal-inner">
          <header className="legal-header">
            <p className="legal-eyebrow">Legal</p>
            <h1>Page unavailable</h1>
            <p className="legal-lead">{error}</p>
          </header>
        </div>
      </section>
    );
  }

  if (!page) {
    return <LegalSkeleton />;
  }

  const title = page.title || "Terms & conditions";
  const lead =
    page.excerpt ||
    "Please read these terms carefully before booking with Dream Drive.";

  return (
    <section className="legal-page">
      <Helmet>
        <title>{page.seoTitle || title}</title>
        <meta
          name="description"
          content={page.seoDescription || page.excerpt || ""}
        />
        {page.seoKeywords ? (
          <meta name="keywords" content={page.seoKeywords} />
        ) : null}
        {page.seoOgImage ? (
          <meta property="og:image" content={page.seoOgImage} />
        ) : null}
        <meta property="og:title" content={page.seoTitle || title} />
        <meta
          property="og:description"
          content={page.seoDescription || page.excerpt || ""}
        />
      </Helmet>

      <div className="legal-inner">
        <header className="legal-header">
          <p className="legal-eyebrow">Legal</p>
          <h1>{title}</h1>
          <p className="legal-lead">{lead}</p>
        </header>

        <article
          className="legal-content"
          dangerouslySetInnerHTML={{ __html: page.body }}
        />

        <div className="legal-cta">
          <p>Questions about these terms?</p>
          <Link to="/contact">
            Contact us
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </div>
      </div>
    </section>
  );
}
