import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center text-purple-400 hover:text-purple-300 transition-colors mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
          <p className="text-gray-400 mt-2">Effective Date: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 space-y-8 text-gray-300">
          
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Introduction</h2>
            <p>
              Digis ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our 
              platform. Please read this policy carefully.
            </p>
            <p className="mt-3 text-red-400 font-semibold">
              ⚠️ By using Digis, you must be 18 years or older and consent to this Privacy Policy.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold text-white mb-2">1.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li><strong>Account Information:</strong> Email, username, password, display name</li>
              <li><strong>Profile Information:</strong> Bio, profile picture, location (optional)</li>
              <li><strong>Age Verification:</strong> Date of birth, age confirmation</li>
              <li><strong>Creator Verification (KYC):</strong> Government ID, address proof, tax information</li>
              <li><strong>Payment Information:</strong> Credit card details (processed by Stripe), bank account for payouts</li>
              <li><strong>Communications:</strong> Messages, support tickets, feedback</li>
              <li><strong>Content:</strong> Photos, videos, streams, posts you create</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">1.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li><strong>Device Information:</strong> IP address, browser type, operating system</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, interaction with creators</li>
              <li><strong>Cookies:</strong> Session cookies, preference cookies, analytics cookies</li>
              <li><strong>Log Data:</strong> Access times, error logs, referral URLs</li>
              <li><strong>Location Data:</strong> Approximate location based on IP address</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">1.3 Information from Third Parties</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>OAuth Providers:</strong> Profile information from Google, Twitter/X</li>
              <li><strong>Payment Processors:</strong> Transaction confirmations from Stripe</li>
              <li><strong>Identity Verification:</strong> KYC results from verification services</li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            
            <h3 className="text-lg font-semibold text-white mb-2">2.1 To Provide Services</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Create and manage your account</li>
              <li>Facilitate connections between fans and creators</li>
              <li>Process token purchases and creator payouts</li>
              <li>Enable video calls, messaging, and streaming</li>
              <li>Verify age and identity for compliance</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">2.2 To Improve Our Platform</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Analyze usage patterns and preferences</li>
              <li>Develop new features and services</li>
              <li>Optimize performance and user experience</li>
              <li>Conduct research and analytics</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">2.3 For Safety and Security</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Detect and prevent fraud</li>
              <li>Enforce Terms of Service</li>
              <li>Investigate violations and suspicious activity</li>
              <li>Protect users from harmful content</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">2.4 For Communications</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Send account notifications</li>
              <li>Provide customer support</li>
              <li>Send marketing communications (with consent)</li>
              <li>Notify about platform updates</li>
            </ul>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Share Your Information</h2>
            
            <h3 className="text-lg font-semibold text-white mb-2">3.1 With Other Users</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Profile information visible to other users</li>
              <li>Content you choose to share publicly</li>
              <li>Interactions during video calls and messaging</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">3.2 With Service Providers</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li><strong>Payment Processing:</strong> Stripe for payments and payouts</li>
              <li><strong>Identity Verification:</strong> KYC service providers</li>
              <li><strong>Cloud Storage:</strong> AWS/Supabase for data hosting</li>
              <li><strong>Video Services:</strong> Agora.io for video/voice calls</li>
              <li><strong>Analytics:</strong> Tools to understand usage patterns</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">3.3 For Legal Reasons</h3>
            <p className="mb-2">We may disclose information when required to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Comply with legal obligations or court orders</li>
              <li>Respond to government requests</li>
              <li>Protect our legal rights</li>
              <li>Prevent harm to users or others</li>
              <li>Investigate fraud or security issues</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">3.4 Business Transfers</h3>
            <p>
              If Digis is involved in a merger, acquisition, or sale of assets, your information may be 
              transferred as part of that transaction. We will notify you of any such change.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Retention</h2>
            <div className="space-y-3">
              <p>We retain your information for as long as necessary to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide our services</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes</li>
                <li>Enforce our agreements</li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white mt-4">Retention Periods</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Account Data:</strong> Until account deletion + 30 days</li>
                <li><strong>Transaction Records:</strong> 7 years for tax compliance</li>
                <li><strong>KYC Documents:</strong> 5 years after last activity</li>
                <li><strong>Content:</strong> 90 days after deletion request</li>
                <li><strong>Logs:</strong> 12 months</li>
              </ul>
            </div>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Security</h2>
            <p className="mb-3">We implement industry-standard security measures including:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Encryption of data in transit (TLS/SSL)</li>
              <li>Encryption of sensitive data at rest</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>Regular security audits</li>
              <li>Access controls and authentication</li>
              <li>PCI DSS compliance for payment data</li>
              <li>Regular backups and disaster recovery</li>
            </ul>
            <p className="mt-3 text-yellow-400">
              While we strive to protect your information, no method of transmission over the internet 
              is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Your Privacy Rights</h2>
            
            <h3 className="text-lg font-semibold text-white mb-2">6.1 Access and Portability</h3>
            <p>You have the right to access and download your personal data.</p>
            
            <h3 className="text-lg font-semibold text-white mb-2 mt-4">6.2 Correction</h3>
            <p>You can update or correct your information through your account settings.</p>
            
            <h3 className="text-lg font-semibold text-white mb-2 mt-4">6.3 Deletion</h3>
            <p>You can request deletion of your account and personal data, subject to legal retention requirements.</p>
            
            <h3 className="text-lg font-semibold text-white mb-2 mt-4">6.4 Opt-Out</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Marketing emails: Unsubscribe link in emails</li>
              <li>Cookies: Browser settings or cookie preferences</li>
              <li>Push notifications: Device settings</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2 mt-4">6.5 Restriction</h3>
            <p>You can request we limit processing of your data in certain circumstances.</p>
          </section>

          {/* Regional Rights */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Regional Privacy Rights</h2>
            
            <h3 className="text-lg font-semibold text-white mb-2">7.1 GDPR (European Union)</h3>
            <p className="mb-2">EU residents have additional rights including:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Right to be informed</li>
              <li>Right to object to processing</li>
              <li>Right to data portability</li>
              <li>Right to lodge a complaint with supervisory authority</li>
              <li>Legal basis: Consent or legitimate interests</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">7.2 CCPA (California)</h3>
            <p className="mb-2">California residents have rights including:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Right to know what information is collected</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of sale (we do not sell personal data)</li>
              <li>Right to non-discrimination</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">7.3 Other Jurisdictions</h3>
            <p>
              Residents of other jurisdictions may have additional rights under local laws. 
              Contact us for information specific to your region.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Cookies and Tracking</h2>
            
            <h3 className="text-lg font-semibold text-white mb-2">8.1 Types of Cookies We Use</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li><strong>Essential:</strong> Required for platform functionality</li>
              <li><strong>Performance:</strong> Help us understand usage patterns</li>
              <li><strong>Functional:</strong> Remember your preferences</li>
              <li><strong>Analytics:</strong> Measure and improve services</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">8.2 Managing Cookies</h3>
            <p>
              You can control cookies through your browser settings. Disabling certain cookies may 
              limit platform functionality.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2 mt-4">8.3 Do Not Track</h3>
            <p>
              We do not currently respond to Do Not Track signals. We do not track users across 
              third-party websites.
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Children's Privacy</h2>
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400 font-semibold">
                ⛔ Digis is strictly for users 18 years and older.
              </p>
              <p className="mt-2">
                We do not knowingly collect information from anyone under 18. If we discover that a 
                user is under 18, we will immediately delete their account and information. If you 
                believe a minor is using our platform, please contact us immediately.
              </p>
            </div>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own. 
              These countries may have different data protection laws. By using Digis, you consent to 
              such transfers. We use appropriate safeguards including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
              <li>Standard contractual clauses</li>
              <li>Data processing agreements</li>
              <li>Privacy Shield frameworks (where applicable)</li>
            </ul>
          </section>

          {/* Third-Party Links */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Third-Party Links</h2>
            <p>
              Our platform may contain links to third-party websites. We are not responsible for the 
              privacy practices of these sites. We encourage you to read their privacy policies.
            </p>
          </section>

          {/* Changes to Policy */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of material changes via:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
              <li>Email notification</li>
              <li>Platform notification</li>
              <li>Notice on our website</li>
            </ul>
            <p className="mt-3">
              Continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Contact Us</h2>
            <div className="bg-white/5 p-6 rounded-lg">
              <p className="font-semibold text-white mb-3">Privacy Inquiries</p>
              
              <div className="space-y-2">
                <p><strong>Email:</strong> privacy@digis.com</p>
                <p><strong>Data Protection Officer:</strong> dpo@digis.com</p>
                <p><strong>GDPR Representative:</strong> gdpr@digis.com</p>
                <p><strong>CCPA Requests:</strong> ccpa@digis.com</p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="font-semibold text-white mb-2">Mailing Address:</p>
                <p>Digis, Inc.</p>
                <p>Privacy Department</p>
                <p>[Address to be provided]</p>
              </div>

              <p className="mt-4 text-sm text-gray-400">
                For general support, please use the in-app support system or email support@digis.com
              </p>
            </div>
          </section>

          {/* Data Protection Officer */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Data Protection Officer</h2>
            <p>
              Our Data Protection Officer can be contacted at dpo@digis.com for any questions about 
              this Privacy Policy or our data practices.
            </p>
          </section>

          {/* Acceptance */}
          <section className="border-t border-white/10 pt-8">
            <p className="text-center text-sm text-gray-400">
              By using Digis, you acknowledge that you have read and understood this Privacy Policy 
              and agree to the collection, use, and disclosure of your information as described herein.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;