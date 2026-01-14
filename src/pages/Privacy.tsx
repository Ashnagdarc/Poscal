import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="pt-12 pb-6 px-6 animate-fade-in bg-gradient-to-b from-background to-background/50 sticky top-0 backdrop-blur-sm z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-secondary/80 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:bg-secondary mb-4"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-1">Last updated: January 14, 2026</p>
      </header>

      {/* Content */}
      <main className="px-6 space-y-6 animate-slide-up">
        <section>
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 mb-4">
            <p className="text-sm text-foreground/90 leading-relaxed">
              At Poscal FX, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
          
          <h3 className="text-lg font-medium text-foreground mb-2 mt-4">Personal Information</h3>
          <p className="text-muted-foreground leading-relaxed mb-2">
            We collect information that you provide directly to us:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Email address (for account creation and authentication)</li>
            <li>Profile information (name, preferences)</li>
            <li>Trading account information (account names, balances, broker details)</li>
            <li>Journal entries and trading data</li>
            <li>Communication preferences</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mb-2 mt-4">Automatically Collected Information</h3>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Device information (type, operating system, browser)</li>
            <li>Usage data (features accessed, time spent, interactions)</li>
            <li>IP address and location data</li>
            <li>Push notification tokens (if you enable notifications)</li>
            <li>App version and performance metrics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            We use the collected information for the following purposes:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2 ml-4">
            <li><span className="font-medium text-foreground">Account Management:</span> Create and manage your account, authenticate your identity</li>
            <li><span className="font-medium text-foreground">Service Delivery:</span> Provide calculator tools, trading journal, price data, and signals</li>
            <li><span className="font-medium text-foreground">Personalization:</span> Customize your experience based on preferences</li>
            <li><span className="font-medium text-foreground">Notifications:</span> Send push notifications about signals and updates (with your consent)</li>
            <li><span className="font-medium text-foreground">Analytics:</span> Understand how users interact with the App to improve features</li>
            <li><span className="font-medium text-foreground">Security:</span> Detect and prevent fraud, abuse, and security issues</li>
            <li><span className="font-medium text-foreground">Communication:</span> Respond to your inquiries and send important updates</li>
            <li><span className="font-medium text-foreground">Legal Compliance:</span> Comply with legal obligations and enforce our Terms</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">3. Data Storage and Security</h2>
          
          <h3 className="text-lg font-medium text-foreground mb-2 mt-4">Where We Store Data</h3>
          <p className="text-muted-foreground leading-relaxed mb-2">
            Your data is securely stored using:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Supabase (authentication and database services)</li>
            <li>Cloud storage providers with encryption</li>
            <li>Local device storage for certain preferences</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mb-2 mt-4">Security Measures</h3>
          <p className="text-muted-foreground leading-relaxed mb-2">
            We implement industry-standard security measures:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>End-to-end encryption for sensitive data</li>
            <li>Secure HTTPS connections</li>
            <li>Regular security audits and updates</li>
            <li>Access controls and authentication</li>
            <li>Data backup and disaster recovery procedures</li>
          </ul>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mt-3">
            <p className="text-sm text-foreground/90 leading-relaxed">
              ⚠️ While we take reasonable measures to protect your information, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">4. Information Sharing and Disclosure</h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            We do not sell your personal information. We may share your information only in the following circumstances:
          </p>
          
          <h3 className="text-lg font-medium text-foreground mb-2 mt-4">Service Providers</h3>
          <p className="text-muted-foreground leading-relaxed mb-2">
            We share data with third-party service providers who help us operate the App:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Authentication services (Supabase Auth)</li>
            <li>Database and cloud storage providers</li>
            <li>Price data providers (Twelve Data, etc.)</li>
            <li>Analytics and performance monitoring tools</li>
            <li>Push notification services</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mb-2 mt-4">Legal Requirements</h3>
          <p className="text-muted-foreground leading-relaxed">
            We may disclose your information if required by law, court order, or government request, or to protect our rights, property, or safety.
          </p>

          <h3 className="text-lg font-medium text-foreground mb-2 mt-4">Business Transfers</h3>
          <p className="text-muted-foreground leading-relaxed">
            In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new owner.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">5. Your Privacy Rights</h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            You have the following rights regarding your personal information:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2 ml-4">
            <li><span className="font-medium text-foreground">Access:</span> Request a copy of the personal data we hold about you</li>
            <li><span className="font-medium text-foreground">Correction:</span> Update or correct inaccurate information</li>
            <li><span className="font-medium text-foreground">Deletion:</span> Request deletion of your account and data</li>
            <li><span className="font-medium text-foreground">Data Portability:</span> Receive your data in a portable format</li>
            <li><span className="font-medium text-foreground">Opt-Out:</span> Unsubscribe from marketing communications</li>
            <li><span className="font-medium text-foreground">Withdraw Consent:</span> Revoke permission for data processing</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            To exercise these rights, please contact us at info@poscalfx.com
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
          <p className="text-muted-foreground leading-relaxed">
            We retain your personal information for as long as necessary to provide our services and comply with legal obligations. When you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it for legal purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">7. Cookies and Tracking Technologies</h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            We use cookies and similar tracking technologies to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Maintain your session and keep you logged in</li>
            <li>Remember your preferences and settings</li>
            <li>Analyze app usage and performance</li>
            <li>Provide personalized content</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-2">
            You can control cookies through your browser settings, but disabling them may affect app functionality.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">8. Children's Privacy</h2>
          <p className="text-muted-foreground leading-relaxed">
            Poscal FX is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child without parental consent, we will take steps to delete that information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">9. International Data Transfers</h2>
          <p className="text-muted-foreground leading-relaxed">
            Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. By using the App, you consent to the transfer of your information to these countries. We ensure appropriate safeguards are in place to protect your data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">10. Third-Party Links</h2>
          <p className="text-muted-foreground leading-relaxed">
            The App may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">11. Push Notifications</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you enable push notifications, we will collect your device token to send you alerts about trading signals and app updates. You can disable push notifications at any time through the App settings or your device settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">12. Changes to This Privacy Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any material changes by updating the "Last updated" date and, where appropriate, sending you a notification. Your continued use of the App after changes are posted constitutes acceptance of the updated Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">13. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
          </p>
          <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
            <p className="text-foreground">
              <span className="font-medium">Email:</span> info@poscalfx.com
            </p>
            <p className="text-foreground">
              <span className="font-medium">App Name:</span> Poscal FX
            </p>
          </div>
        </section>

        <section className="pt-4">
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
            <p className="text-sm text-foreground/90 leading-relaxed">
              By using Poscal FX, you acknowledge that you have read and understood this Privacy Policy and agree to the collection, use, and disclosure of your information as described herein.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Privacy;
