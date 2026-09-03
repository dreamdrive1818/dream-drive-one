import React from "react";

import FleetCarousel from "../fleetCarousel/FleetCarousel";
import WhyChoose from "../whychooseus/WhyChooseUs";
import HowItWorks from "../HowItWorks/HowItWorks";
import Achievements from "../Achievements/Achievements";
import Contact from "../contact/Contact";
import Hero2 from "../hero/Hero2/Hero2";
import Testimonial from "../Testimonial/Testimonial";
import Blogs from "../blogs/Blogs";
import "./Home.css";
import { Helmet } from "react-helmet-async";
import { usePageSeoSuppression } from "../../utils/usePageSeoSuppression";
import { useLocalContext } from "../../context/LocalContext";

const Home = () => {
  usePageSeoSuppression(true);
  const { cms, webinfo } = useLocalContext();
  const title = cms.page?.seoTitle || cms.page?.title || webinfo.seo.defaultTitle;
  const description = cms.page?.seoDescription || cms.page?.excerpt || webinfo.seo.description;
  const ogImage = cms.page?.seoOgImage || webinfo.seo.ogImage;

  return (
    <div className="home">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        {cms.page?.seoKeywords ? <meta name="keywords" content={cms.page.seoKeywords} /> : null}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
      </Helmet>

      <Hero2 />
      <FleetCarousel />
      <WhyChoose />
      <HowItWorks />
      <Achievements />
      <Blogs />
      <Contact />
      <Testimonial />
    </div>
  );
};

export default Home;
