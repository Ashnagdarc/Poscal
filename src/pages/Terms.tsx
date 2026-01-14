import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
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
        <h1 className="text-3xl font-bold text-foreground">Terms and Conditions</h1>
        <p className="text-sm text-muted-foreground mt-1">Last updated: January 14, 2026</p>
      </header>

      {/* Content */}
      <main className="px-6 space-y-6 animate-slide-up">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            By accessing and using Poscal FX ("the App"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use the App.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            Poscal FX is a trading position size calculator and journal application designed to help traders:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Calculate position sizes based on risk parameters</li>
            <li>Track and journal trading activities</li>
            <li>View real-time price data and trading signals</li>
            <li>Manage multiple trading accounts</li>
            <li>Receive push notifications for trading updates</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">3. Trading Risk Disclaimer</h2>
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 mb-3">
            <p className="text-destructive font-medium mb-2">⚠️ Important Trading Warning</p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Trading foreign exchange, contracts for difference (CFDs), and other leveraged products carries a high level of risk and may not be suitable for all investors. You may lose some or all of your invested capital.
            </p>
          </div>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-2 ml-4">
            <li>The App provides tools and information for educational purposes only</li>
            <li>The App does not provide financial, investment, or trading advice</li>
            <li>All trading decisions are your sole responsibility</li>
            <li>Past performance is not indicative of future results</li>
            <li>We are not liable for any financial losses incurred through trading</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">4. User Accounts</h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            When you create an account with us, you agree to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Notify us immediately of any unauthorized access</li>
            <li>Be responsible for all activities under your account</li>
            <li>Not share your account with others</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">5. Accuracy of Information</h2>
          <p className="text-muted-foreground leading-relaxed">
            While we strive to provide accurate and up-to-date information, including price data and calculations, we do not guarantee the accuracy, completeness, or timeliness of any information provided through the App. Always verify information from multiple sources before making trading decisions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">6. Prohibited Uses</h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            You agree not to use the App to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Violate any applicable laws or regulations</li>
            <li>Transmit any harmful or malicious code</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with or disrupt the App's functionality</li>
            <li>Use automated systems to access the App without permission</li>
            <li>Reverse engineer or copy any features or functionality</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">7. Third-Party Services</h2>
          <p className="text-muted-foreground leading-relaxed">
            The App may integrate with third-party services for price data, authentication, storage, and other features. We are not responsible for the availability, accuracy, or content of these third-party services. Your use of third-party services is subject to their respective terms and conditions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">8. Intellectual Property</h2>
          <p className="text-muted-foreground leading-relaxed">
            The App and its original content, features, and functionality are owned by Poscal FX and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">9. Premium Features and Subscriptions</h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            When premium features become available:
          </p>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Subscriptions will be billed on a recurring basis</li>
            <li>You can cancel at any time before the next billing cycle</li>
            <li>Refunds are subject to our refund policy</li>
            <li>Prices may change with advance notice</li>
            <li>Premium features may be modified or discontinued</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">10. Termination</h2>
          <p className="text-muted-foreground leading-relaxed">
            We reserve the right to terminate or suspend your account and access to the App immediately, without prior notice or liability, for any reason, including breach of these Terms. Upon termination, your right to use the App will immediately cease.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">11. Limitation of Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the maximum extent permitted by law, Poscal FX and its affiliates, officers, employees, and partners shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, or other intangible losses resulting from your use or inability to use the App.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">12. Indemnification</h2>
          <p className="text-muted-foreground leading-relaxed">
            You agree to indemnify, defend, and hold harmless Poscal FX and its affiliates from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the App, violation of these Terms, or infringement of any rights of another party.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">13. Changes to Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            We reserve the right to modify or replace these Terms at any time. We will provide notice of any material changes by updating the "Last updated" date. Your continued use of the App after any changes constitutes acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">14. Governing Law</h2>
          <p className="text-muted-foreground leading-relaxed">
            These Terms shall be governed by and construed in accordance with applicable international laws, without regard to conflict of law provisions. Any disputes arising from these Terms or use of the App shall be subject to the exclusive jurisdiction of the appropriate courts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">15. Contact Information</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions about these Terms, please contact us at:
          </p>
          <div className="mt-3 bg-secondary/50 rounded-xl p-4">
            <p className="text-foreground font-medium">Email: info@poscalfx.com</p>
          </div>
        </section>

        <section className="pt-4">
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
            <p className="text-sm text-foreground/90 leading-relaxed">
              By using Poscal FX, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Terms;
