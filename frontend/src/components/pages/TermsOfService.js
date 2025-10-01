import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const TermsOfService = () => {
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
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 space-y-8 text-gray-300">
          
          {/* Age Requirement Section */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Age Requirement</h2>
            <div className="space-y-3">
              <p className="text-red-400 font-semibold text-lg">
                ⚠️ You must be at least 18 years old to use Digis.
              </p>
              <p>
                By accessing or using Digis, you confirm that you are at least eighteen (18) years of age. 
                If you are under 18 years old, you are prohibited from using our services.
              </p>
              <p>
                We reserve the right to request proof of age at any time. Providing false information about 
                your age is a violation of these Terms and will result in immediate account termination.
              </p>
            </div>
          </section>

          {/* Acceptance of Terms */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Acceptance of Terms</h2>
            <p>
              By creating an account, accessing, or using Digis ("the Platform"), you agree to be bound by 
              these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Platform.
            </p>
          </section>

          {/* User Accounts */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">3.1 Account Types</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Fan Accounts:</strong> For users who wish to connect with and support creators</li>
                <li><strong>Creator Accounts:</strong> For content creators who provide services and content</li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white mt-4">3.2 Account Responsibilities</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You must provide accurate and complete information</li>
                <li>You are responsible for maintaining account security</li>
                <li>You must not share your account credentials</li>
                <li>You must notify us immediately of any unauthorized use</li>
                <li>One person may not maintain multiple accounts</li>
              </ul>
            </div>
          </section>

          {/* Prohibited Content & Conduct */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Prohibited Content & Conduct</h2>
            <p className="mb-3">Users must not post, share, or engage in:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Content involving minors or that sexualizes minors</li>
              <li>Non-consensual content or "revenge porn"</li>
              <li>Content that promotes illegal activities</li>
              <li>Harassment, bullying, or threats</li>
              <li>Hate speech or discrimination</li>
              <li>Impersonation of others</li>
              <li>Spam or misleading content</li>
              <li>Copyright infringement or intellectual property violations</li>
              <li>Malware, viruses, or harmful code</li>
              <li>Commercial solicitation outside of creator services</li>
              <li>Any content that violates local, state, or federal laws</li>
            </ul>
          </section>

          {/* Creator Verification */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Creator Verification & KYC</h2>
            <div className="space-y-3">
              <p className="text-yellow-400 font-semibold">
                All creators must complete identity verification before receiving payouts.
              </p>
              <h3 className="text-lg font-semibold text-white">5.1 Required Documentation</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Government-issued photo ID</li>
                <li>Proof of address (utility bill, bank statement)</li>
                <li>Tax identification (SSN/EIN for US, appropriate forms for international)</li>
                <li>Bank account information for payouts</li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white mt-4">5.2 Tax Compliance</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>US creators must provide W-9 form</li>
                <li>International creators must provide W-8BEN or W-8BEN-E</li>
                <li>Creators are responsible for their own tax obligations</li>
                <li>1099 forms will be issued for US creators earning over $600/year</li>
              </ul>
            </div>
          </section>

          {/* Payment Terms */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Payment Terms</h2>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">6.1 Token System</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Digis uses a token-based payment system</li>
                <li>Tokens are purchased with real currency and are non-refundable</li>
                <li>Token prices and packages may change with notice</li>
                <li>Unused tokens do not expire but have no cash value</li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white mt-4">6.2 Creator Earnings</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Creators earn tokens from user interactions</li>
                <li>Platform fee: 20% of all creator earnings</li>
                <li>Minimum payout threshold: $50 USD equivalent</li>
                <li>Payouts processed weekly via Stripe or bank transfer</li>
                <li>Creators must complete KYC verification for payouts</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-4">6.3 Refund Policy</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Token purchases are final and non-refundable</li>
                <li>Disputed charges may result in account suspension</li>
                <li>Technical issues resulting in service failure may be credited</li>
              </ul>
            </div>
          </section>

          {/* DMCA Compliance */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. DMCA Compliance</h2>
            <div className="space-y-3">
              <p>
                Digis respects intellectual property rights and complies with the Digital Millennium 
                Copyright Act (DMCA). 
              </p>
              
              <h3 className="text-lg font-semibold text-white">7.1 Copyright Infringement Reports</h3>
              <p>To report copyright infringement, send a DMCA notice to:</p>
              <div className="bg-white/5 p-4 rounded-lg mt-2">
                <p>Email: dmca@digis.com</p>
                <p>Subject: DMCA Takedown Request</p>
              </div>
              
              <h3 className="text-lg font-semibold text-white mt-4">7.2 Required Information</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Identification of copyrighted work</li>
                <li>URL of infringing content</li>
                <li>Your contact information</li>
                <li>Statement of good faith belief</li>
                <li>Statement of accuracy under penalty of perjury</li>
                <li>Physical or electronic signature</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-4">7.3 Counter-Notice</h3>
              <p>
                Users who believe their content was wrongly removed may submit a counter-notice 
                following the same process.
              </p>
            </div>
          </section>

          {/* Privacy & Data */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Privacy & Data Protection</h2>
            <div className="space-y-3">
              <p>
                Your privacy is important to us. Please review our{' '}
                <Link to="/privacy" className="text-purple-400 hover:text-purple-300 underline">
                  Privacy Policy
                </Link>{' '}
                for information on how we collect, use, and protect your data.
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We comply with GDPR for EU users</li>
                <li>We comply with CCPA for California residents</li>
                <li>Users have the right to request data deletion</li>
                <li>We use industry-standard encryption for data protection</li>
              </ul>
            </div>
          </section>

          {/* Content Ownership */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Content Ownership & Licensing</h2>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">9.1 Your Content</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You retain ownership of content you create</li>
                <li>You grant Digis a license to host and display your content</li>
                <li>You warrant that you have rights to all content you post</li>
                <li>You are responsible for your content's legality</li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white mt-4">9.2 Platform Content</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Digis owns all platform content, logos, and trademarks</li>
                <li>Users may not use Digis branding without permission</li>
                <li>Screenshots and recordings require consent from all parties</li>
              </ul>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Account Termination</h2>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">10.1 Voluntary Termination</h3>
              <p>Users may delete their accounts at any time through account settings.</p>
              
              <h3 className="text-lg font-semibold text-white mt-4">10.2 Involuntary Termination</h3>
              <p>Digis may suspend or terminate accounts for:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Violation of these Terms</li>
                <li>Illegal activities</li>
                <li>Fraudulent behavior</li>
                <li>Multiple user complaints</li>
                <li>Non-payment or chargebacks</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-4">10.3 Effect of Termination</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Unused tokens are forfeited</li>
                <li>Pending creator payouts will be processed</li>
                <li>Content may be retained for legal compliance</li>
                <li>Users may not create new accounts after termination for violations</li>
              </ul>
            </div>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Disclaimers & Limitations</h2>
            <div className="space-y-3">
              <p className="uppercase text-sm">
                THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. DIGIS DISCLAIMS ALL 
                WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
              </p>
              <p className="uppercase text-sm mt-3">
                DIGIS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES 
                ARISING FROM USE OF THE PLATFORM.
              </p>
              <p className="mt-3">
                Some jurisdictions do not allow disclaimer of warranties or limitation of liability, 
                so these provisions may not apply to you.
              </p>
            </div>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Digis, its officers, directors, employees, and 
              agents from any claims, damages, losses, or expenses (including legal fees) arising from 
              your use of the Platform, violation of these Terms, or infringement of any third-party rights.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Governing Law & Disputes</h2>
            <div className="space-y-3">
              <p>
                These Terms are governed by the laws of the State of Delaware, United States, without 
                regard to conflict of law principles.
              </p>
              <p>
                Any disputes shall be resolved through binding arbitration in accordance with the American 
                Arbitration Association rules. Class action lawsuits and jury trials are waived.
              </p>
            </div>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">14. Changes to Terms</h2>
            <p>
              We may update these Terms at any time. Continued use of the Platform after changes constitutes 
              acceptance of the new Terms. We will notify users of material changes via email or platform 
              notification.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">15. Contact Information</h2>
            <div className="bg-white/5 p-6 rounded-lg">
              <p className="font-semibold text-white mb-2">Digis Support</p>
              <p>Email: legal@digis.com</p>
              <p>DMCA: dmca@digis.com</p>
              <p>Privacy: privacy@digis.com</p>
              <p className="mt-3 text-sm text-gray-400">
                For general support, please use the in-app support system.
              </p>
            </div>
          </section>

          {/* Acceptance Button for New Users */}
          <section className="border-t border-white/10 pt-8">
            <p className="text-center text-sm text-gray-400">
              By using Digis, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;