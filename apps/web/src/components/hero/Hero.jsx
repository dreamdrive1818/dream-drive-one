import React from 'react';
import './Hero.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebookF, faInstagram, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { useNavigate } from 'react-router-dom';


const Hero = () => {

  const navigate = useNavigate();

  return (
    <section className="hero">
      <div className="hero-div">
    
      <div className="hero-left reveal-bottom">
        <h1>Your Journey,<br />Your Car,<br />Your Way</h1>
        <p>
          Experience the ultimate freedom of choice with GoCar – tailor your
          adventure by choosing from our premium fleet of vehicles.
        </p>
        <button className="btn-started" onClick={()=>navigate('/howitworks')}>Get Started</button>
        <div className="hero-socials">
        <div className="hero-socials">
  <a href="https://facebook.com" target="_blank" rel="noreferrer" className="social-icon fb">
    <FontAwesomeIcon icon={faFacebookF} />
  </a>
  <a href="https://instagram.com" target="_blank" rel="noreferrer" className="social-icon insta">
    <FontAwesomeIcon icon={faInstagram} />
  </a>
  <a href="https://twitter.com" target="_blank" rel="noreferrer" className="social-icon tw">
    <FontAwesomeIcon icon={faTwitter} />
  </a>
</div>

</div>

      </div>

      <div className="hero-center">
        <img src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1744881450/istockphoto-184127993-612x612-removebg-preview_caadfj.png" alt="Red Car" className="hero-car" />
        <div className="hero-badge">
          <span>08+</span>
          <small>Car Types Available</small>
        </div>
      </div>

      <div className="hero-right ">
        <div className="hero-right-top reveal-bottom">
          <div className="hero-users">
          <img src="https://images.unsplash.com/flagged/photo-1571367034861-e6729ad9c2d5?q=80&w=1964&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="User 1" />
          <img src="https://images.unsplash.com/photo-1540569014015-19a7be504e3a?q=80&w=1935&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="User 2" />
          <img src="https://images.unsplash.com/photo-1577760960310-c49bbb09161e?q=80&w=1972&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="User 3" />
          </div>
          <p><strong>100+ PEOPLE</strong></p>
          <p>have used our services such as renting, buying, or even selling their car.</p>    
        </div>
        <div className="hero-right-bot reveal-bottom delay-0">
       
        <div className="hero-actions ">
          <button onClick={()=>navigate('/contact')}>Rent</button>
          <button onClick={()=>navigate('/contact')}>Buy</button>
          <button onClick={()=>navigate('/contact')}>Sell</button>
          <button onClick={()=>navigate('/contact')}>Consult</button>
        </div>
        <a href="/" className="learn-more">Learn more →</a>
        </div>
      </div>
          
      </div>
    </section>
  );
};

export default Hero;
