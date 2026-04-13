'use client'
import Link from 'next/link'
import '@/styles/landing.css'

export default function PrivacyPage() {
  return (
    <div className="landing" style={{ background: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px 60px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#22C55E', fontWeight: 600, fontSize: 14, textDecoration: 'none', marginBottom: 32 }}>← Back to Home</Link>

        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: '#64748B', marginBottom: 40 }}>Last updated: January 2025</p>

        <div style={{ fontSize: 15, lineHeight: 1.8, color: '#374151' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>1. Introduction</h2>
          <p>BrainWare ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our retail management platform.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>2. Information We Collect</h2>
          <p><strong>Account Information:</strong> When you register, we collect your name, email address, phone number, and business information (store name, address).</p>
          <p><strong>Usage Data:</strong> We automatically collect information about how you interact with our platform, including pages visited, features used, and session duration.</p>
          <p><strong>Business Data:</strong> Sales transactions, inventory data, employee information, and other operational data you enter into the platform.</p>
          <p><strong>Payment Information:</strong> We collect payment method details for billing purposes. Payment processing is handled by our third-party payment provider.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul style={{ paddingLeft: 24 }}>
            <li>Provide, maintain, and improve our platform</li>
            <li>Process transactions and send related information</li>
            <li>Send administrative notifications and updates</li>
            <li>Respond to your requests and provide customer support</li>
            <li>Monitor and analyze usage trends to improve user experience</li>
            <li>Protect against unauthorized access and ensure security</li>
          </ul>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>4. Data Security</h2>
          <p>We implement industry-standard security measures to protect your data, including:</p>
          <ul style={{ paddingLeft: 24 }}>
            <li>End-to-end encryption for data in transit and at rest</li>
            <li>Secure authentication with row-level security (RLS)</li>
            <li>Regular security audits and monitoring</li>
            <li>Automatic encrypted backups</li>
          </ul>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>5. Data Sharing</h2>
          <p>We do not sell, trade, or rent your personal information to third parties. We may share data with:</p>
          <ul style={{ paddingLeft: 24 }}>
            <li>Service providers who assist in operating our platform (hosting, payment processing)</li>
            <li>Law enforcement when required by law</li>
            <li>Business partners with your explicit consent</li>
          </ul>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>6. Data Retention</h2>
          <p>We retain your data for as long as your account is active. Upon account deletion, we will delete or anonymize your data within 30 days, except where retention is required by law.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>7. Your Rights (GDPR)</h2>
          <p>Under GDPR, you have the right to:</p>
          <ul style={{ paddingLeft: 24 }}>
            <li>Access your personal data</li>
            <li>Rectify inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to data processing</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time</li>
          </ul>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>8. Cookies</h2>
          <p>We use essential cookies for authentication and platform functionality. We do not use tracking or advertising cookies.</p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 40, marginBottom: 12 }}>9. Contact Us</h2>
          <p>For any privacy-related questions, contact us at: <strong>privacy@brainware.io</strong></p>
        </div>
      </div>
    </div>
  )
}
