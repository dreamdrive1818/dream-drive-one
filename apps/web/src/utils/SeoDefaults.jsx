// src/seo/SeoDefaults.jsx
import React from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { useLocalContext } from "../context/LocalContext";

const toAbsolute = (base, path = "") => {
  if (!base) return "";
  try { return new URL(path || "/", base).toString(); } catch { return ""; }
};

const SeoDefaults = () => {
  const { pathname, search } = useLocation();
  const { webinfo = {}, suppressSeo } = useLocalContext();

  // Brand identity
  const name = webinfo?.name || "Dream Drive";

  // Central SEO config from context
  const seo = webinfo?.seo || {};
  const {
    siteUrl = "https://dream-drive.co.in/",
    tagline = "Ranchi’s Trusted Self-Drive Car Rentals",
    description = "Book SUVs like Nexon & Compass with flexible packages, 24×7 support, and doorstep delivery in Ranchi.",
    logo = webinfo?.logo,
    ogImage = "",
    twitterHandle = "@dreamdrive",
    socialLinks,
    titleTemplate = "%s | Dream Drive",
    defaultTitle = `${name} — ${tagline}`,
    robots = "index,follow",
  } = seo;

  const isAdmin = pathname.includes("/admin");

  // ✅ No hook here; just compute directly to avoid conditional hook call issue
  const canonical = siteUrl ? toAbsolute(siteUrl, `${pathname}${search || ""}`) : "";

  const absLogo = logo?.startsWith("http") ? logo : toAbsolute(siteUrl, logo);
  const absOgImg = ogImage?.startsWith("http") ? ogImage : toAbsolute(siteUrl, ogImage);

  // If a page wants custom SEO, skip defaults entirely
  if (suppressSeo) return null;

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: siteUrl || undefined,
    logo: absLogo || undefined,
    sameAs: Array.isArray(socialLinks) && socialLinks.length ? socialLinks : undefined,
  };

  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: siteUrl || undefined,
    potentialAction: {
      "@type": "SearchAction",
      target: siteUrl ? `${siteUrl}/search?q={query}` : undefined,
      "query-input": "required name=query",
    },
  };

  return (
    <Helmet defaultTitle={defaultTitle} titleTemplate={titleTemplate}>
      <meta name="robots" content={isAdmin ? "noindex,nofollow" : robots} />
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}

      <meta property="og:site_name" content={name} />
      <meta property="og:type" content="website" />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:title" content={defaultTitle} />
      <meta property="og:description" content={description} />
      {absOgImg && <meta property="og:image" content={absOgImg} />}

      <meta name="twitter:card" content="summary_large_image" />
      {twitterHandle && <meta name="twitter:site" content={twitterHandle} />}
      <meta name="twitter:title" content={defaultTitle} />
      <meta name="twitter:description" content={description} />
      {absOgImg && <meta name="twitter:image" content={absOgImg} />}

      <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(webSiteJsonLd)}</script>
    </Helmet>
  );
};

export default SeoDefaults;
