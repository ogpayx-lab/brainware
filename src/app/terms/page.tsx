'use client'
import Link from 'next/link'
import '@/styles/landing.css'

export default function TermsPage() {
  return (
    <div className="landing" style={{ background: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px 60px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#22C55E', fontWeight: 600, fontSize: 14, textDecoration: 'none', marginBottom: 32 }}>← Back to Home</Link>

        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: '#64748B', marginBottom: 40 }}>Last updated: January 2025</p>

        <div style={{ fontSize: 15, lineHeight: 1.8, color: '#374151' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>1. Acceptance of Terms</h2>
          <p>By accessing or using BrainWare ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>2. Description of Service</h2>
          <p>BrainWare provides a cloud-based retail management platform including point-of-sale (POS), inventory management, employee management, analytics, and multi-store management tools.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>3. Account Registration</h2>
          <p>You must provide accurate and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>4. Free Trial</h2>
          <p>New accounts receive a 30-day free trial with full access to all features. A valid payment method is required for verification purposes only — no charges will be made during the trial period. If you cancel before the trial ends, you will not be charged.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>5. Pricing & Billing</h2>
          <p>After the free trial, billing is based on your selected plan:</p>
          <ul style={{ paddingLeft: 24 }}>
            <li><strong>Starter (€49/month):</strong> 1 Store</li>
            <li><strong>Growth (€99/month):</strong> Up to 3 Stores</li>
            <li><strong>Business (€149/month):</strong> 3-5 Stores</li>
            <li><strong>Enterprise:</strong> Custom pricing for 5+ Stores</li>
          </ul>
          <p>All prices are in EUR and exclusive of applicable taxes. Billing occurs monthly. Plan changes take effect at the next billing cycle.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>6. Data Ownership</h2>
          <p>You retain full ownership of all data you enter into the platform. We do not claim any intellectual property rights over your business data. Upon account termination, you may request a full export of your data.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>7. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul style={{ paddingLeft: 24 }}>
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to the Service</li>
            <li>Interfere with or disrupt the Service</li>
            <li>Share your account credentials with unauthorized parties</li>
            <li>Use the Service to store or transmit malicious code</li>
          </ul>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>8. Service Availability</h2>
          <p>We strive for 99.9% uptime. We are not liable for temporary downtime due to maintenance, updates, or circumstances beyond our control. We will provide reasonable notice of scheduled maintenance.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>9. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, BrainWare shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of the Service.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>10. Termination</h2>
          <p>Either party may terminate the agreement at any time. Upon termination, your access to the Service will be revoked. You may request a data export within 30 days of termination.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>11. Changes to Terms</h2>
          <p>We may update these Terms from time to time. Significant changes will be communicated via email at least 30 days before taking effect.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>12. Governing Law</h2>
          <p>These Terms are governed by the laws of Italy. Any disputes shall be resolved in the courts of Milan, Italy.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>13. Contact</h2>
          <p>For any questions regarding these Terms, contact us at: <strong>legal@brainware.io</strong></p>
        </div>
      </div>
    </div>
  )
}
