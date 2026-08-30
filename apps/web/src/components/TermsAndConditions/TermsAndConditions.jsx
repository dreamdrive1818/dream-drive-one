import React from "react";
import "./TermsAndConditions.css";

const TermsAndConditions = () => {
  return (
    <div className="terms-wrapper">
      <div className="terms-header">
        <h1>Terms & Conditions</h1>
        <p className="company-subtitle">Dream Drive Pvt. Ltd.</p>
      </div>

      <div className="terms-content">
        <section>
          <h2>1. General Terms</h2>
          <p>
            This agreement is made between <strong>Subham Keshri</strong> and <strong>Pooja Kumari</strong> (partners of Dream Drive Pvt. Ltd.) and the Customer renting the vehicle.
          </p>
        </section>

        <section>
          <h2>2. Definitions & Scope</h2>
          <ul>
            <li><strong>Terms & Conditions:</strong> Rules governing use of the rented vehicle.</li>
            <li><strong>Car Hire Company:</strong> Dream Drive Pvt. Ltd.</li>
            <li><strong>Car Owner:</strong> Entity providing the vehicle through the company.</li>
            <li><strong>Vehicle:</strong> The car being rented as per the agreement.</li>
            <li><strong>Customer:</strong> The individual hiring the vehicle.</li>
          </ul>
          <p>Signing the agreement implies full understanding and acceptance of these terms.</p>
        </section>

        <section>
          <h2>3. Vehicle Usage</h2>
          <ul>
            <li>Only verified drivers are permitted to operate the vehicle.</li>
            <li>A valid license recognized by the High Court of Jharkhand is mandatory.</li>
            <li>No driving under influence, fatigue, or ill-health.</li>
            <li>Company may terminate the agreement if terms are violated.</li>
            <li>Minor damages (up to ₹10,000) are the customer’s responsibility.</li>
            <li>Major incidents involve insurance; loss of usage fees apply.</li>
            <li>Full liability in cases of drunk driving or total loss.</li>
            <li>GPS tracking is mandatory; tampering is considered theft.</li>
          </ul>

          <h3>Prohibited Uses</h3>
          <ul>
            <li>Overloading passengers or cargo</li>
            <li>Towing, racing, or off-road driving</li>
            <li>Subleasing, ride-sharing, or using as taxi</li>
            <li>Transport of animals, illegal goods, or smoking/drinking inside</li>
            <li>Traveling outside Jharkhand without written consent</li>
          </ul>
        </section>

        <section>
          <h2>4. Return of Vehicle</h2>
          <p>The vehicle must be returned in clean and proper condition. Complaints are valid only within <strong>T+2 days</strong> of return.</p>
        </section>

        <section>
          <h2>5. Payment Terms</h2>
          <p>Full rental charges must be cleared before the vehicle is handed over.</p>
        </section>

        <section>
          <h2>6. Fuel & Mileage</h2>
          <p>Return fuel level must match the level at delivery. Extra mileage is chargeable.</p>
        </section>

        <section>
          <h2>7. Damage, Theft & Insurance</h2>
          <p>Minor damages to be paid in cash. For theft or major damage, insurance applies but all claim processing and delay charges are the customer's responsibility.</p>
        </section>

        <section>
          <h2>8. Vehicle Condition & Company Responsibility</h2>
          <p>The Company ensures delivery of sanitized, clean, and privately maintained vehicles.</p>
        </section>

        <section>
          <h2>9. Traffic Fines</h2>
          <p>Any traffic or parking fines during the rental period are borne by the customer. Complaints allowed within <strong>T+7 days</strong> of return.</p>
        </section>

        <section>
          <h2>10. Illegal Use</h2>
          <p>Any unlawful activity involving the vehicle during the rental period is fully attributed to the customer.</p>
        </section>

        <section>
          <h2>11. Extensions</h2>
          <p>Rental extension must be pre-approved and prepaid. Failure results in legal action.</p>
        </section>

        <section>
          <h2>12. Legal Jurisdiction</h2>
          <p>This agreement falls under the jurisdiction of the <strong>High Court of Jharkhand (Ranchi)</strong>. Disputes are settled via negotiation or legal means.</p>
        </section>
      </div>
    </div>
  );
};

export default TermsAndConditions;
