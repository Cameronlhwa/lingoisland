import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { OceanBackground } from "@/components/OceanBackground";

const LAST_UPDATED = "May 11, 2026";

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 space-y-3">
      <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 space-y-2">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

const email = "cameron@lingoisland.com";
const site = "https://lingoisland.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="relative min-h-screen">
      <OceanBackground />
      <div className="relative z-10">
        <Nav />

        <article className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0B1B3A] focus:ring-offset-2 rounded"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>

          <div className="rounded-2xl bg-white/90 px-6 py-8 shadow-md backdrop-blur-sm md:bg-white/85 md:px-10 md:py-10">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">Privacy Policy</h1>
            <p className="mt-2 text-sm text-gray-500">Last Updated: {LAST_UPDATED}</p>

            <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-gray-700">
              <p>
                This privacy notice for LingoIsland (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) describes
                how and why we might collect, store, use, and/or share (&ldquo;process&rdquo;) your information when you
                use our services (&ldquo;Services&rdquo;), such as when you:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Visit our website at{" "}
                  <a href={site} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">
                    {site}
                  </a>
                  , or any website of ours that links to this privacy notice
                </li>
                <li>
                  Engage with us in other related ways, including any sales, marketing, or events
                </li>
              </ul>
              <p>
                <strong>Questions or concerns?</strong> Reading this privacy notice will help you understand your privacy
                rights and choices. If you do not agree with our policies and practices, please do not use our Services.
                If you still have any questions or concerns, please contact us at{" "}
                <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">
                  {email}
                </a>
                .
              </p>
            </div>

            {/* Table of Contents */}
            <nav className="mt-8 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm">
              <p className="font-semibold text-gray-900 mb-2">Table of Contents</p>
              <ol className="list-decimal pl-5 space-y-1 text-[#0B1B3A]">
                {[
                  ["#collect", "What Information Do We Collect?"],
                  ["#process", "How Do We Process Your Information?"],
                  ["#legal", "What Legal Bases Do We Rely On?"],
                  ["#share", "When and With Whom Do We Share Your Information?"],
                  ["#cookies", "Do We Use Cookies and Other Tracking Technologies?"],
                  ["#international", "Is Your Information Transferred Internationally?"],
                  ["#retention", "How Long Do We Keep Your Information?"],
                  ["#jurisdiction", "Jurisdiction-Specific Provisions"],
                  ["#safe", "How Do We Keep Your Information Safe?"],
                  ["#rights", "What Are Your Privacy Rights?"],
                  ["#dnt", "Controls for Do-Not-Track Features"],
                  ["#california", "Do California Residents Have Specific Privacy Rights?"],
                  ["#updates", "Do We Make Updates to This Notice?"],
                  ["#contact", "How Can You Contact Us About This Notice?"],
                  ["#delete", "How Can You Review, Update, or Delete the Data We Collect?"],
                ].map(([href, label], i) => (
                  <li key={href}>
                    <a href={href} className="hover:underline underline-offset-2">
                      {label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-8 space-y-1 text-[15px] leading-relaxed text-gray-700">

              <Section id="collect" title="1. What Information Do We Collect?">
                <Sub title="Personal information you disclose to us">
                  <p className="text-sm italic text-gray-500">In Short: We collect personal information that you provide to us.</p>
                  <p>
                    We collect personal information that you voluntarily provide to us when you register on the Services,
                    express an interest in obtaining information about us or our products and Services, when you
                    participate in activities on the Services, or otherwise when you contact us.
                  </p>
                  <p><strong>Personal Information Provided by You</strong></p>
                  <p>The personal information that we collect may include the following:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>names</li>
                    <li>email addresses</li>
                    <li>usernames</li>
                    <li>passwords</li>
                    <li>contact or authentication data</li>
                    <li>learning progress and activity data</li>
                  </ul>
                  <p><strong>Sensitive Information.</strong> We do not process sensitive information.</p>
                  <p>
                    <strong>Payment Data.</strong> We may collect data necessary to process your payment if you make
                    purchases, such as your payment instrument number and the security code associated with your payment
                    instrument. All payment data is stored by{" "}
                    <a href="https://stripe.com/privacy" className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">
                      Stripe, Inc.
                    </a>
                  </p>
                  <p>
                    All personal information that you provide to us must be true, complete, and accurate, and you must
                    notify us of any changes to such personal information.
                  </p>
                </Sub>

                <Sub title="Information automatically collected">
                  <p className="text-sm italic text-gray-500">
                    In Short: Some information — such as your Internet Protocol (IP) address and/or browser and device
                    characteristics — is collected automatically when you visit our Services.
                  </p>
                  <p>
                    We automatically collect certain information when you visit, use, or navigate the Services. This
                    information does not reveal your specific identity but may include device and usage information, such
                    as your IP address, browser and device characteristics, operating system, language preferences,
                    referring URLs, device name, country, location, and information about how and when you use our
                    Services.
                  </p>
                  <p>The information we collect includes:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong>Log and Usage Data:</strong> Service-related, diagnostic, usage, and performance
                      information our servers automatically collect when you access or use our Services.
                    </li>
                    <li>
                      <strong>Device Data:</strong> Information about your computer, phone, tablet, or other device you
                      use to access the Services.
                    </li>
                    <li>
                      <strong>Location Data:</strong> Information about your device&apos;s location, which can be either
                      precise or imprecise.
                    </li>
                  </ul>
                </Sub>
              </Section>

              <Section id="process" title="2. How Do We Process Your Information?">
                <p className="text-sm italic text-gray-500">
                  In Short: We process your information to provide, improve, and administer our Services, communicate
                  with you, for security and fraud prevention, and to comply with law.
                </p>
                <p>We process your personal information for a variety of reasons, including:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>To facilitate account creation and authentication and otherwise manage user accounts.</li>
                  <li>To deliver and facilitate delivery of services to the user, including AI-powered language learning features.</li>
                  <li>To respond to user inquiries and offer support to users.</li>
                  <li>To fulfill and manage your orders and subscriptions.</li>
                  <li>To request feedback and improve the Services.</li>
                  <li>To send you marketing and promotional communications (where permitted by law).</li>
                  <li>To protect our Services from fraud, abuse, and security threats.</li>
                  <li>To identify usage trends and improve user experience.</li>
                  <li>To comply with our legal obligations.</li>
                </ul>
              </Section>

              <Section id="legal" title="3. What Legal Bases Do We Rely On to Process Your Information?">
                <p className="text-sm italic text-gray-500">
                  In Short: We only process your personal information when we believe it is necessary and we have a valid
                  legal reason to do so under applicable law.
                </p>
                <p>If you are located in the EU or UK, this section applies to you. We may rely on the following legal bases:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Consent:</strong> You can withdraw your consent at any time.</li>
                  <li><strong>Performance of a Contract:</strong> To fulfill our contractual obligations to you.</li>
                  <li><strong>Legitimate Interests:</strong> For our business interests that do not override your rights.</li>
                  <li><strong>Legal Obligations:</strong> To comply with the law.</li>
                  <li><strong>Vital Interests:</strong> To protect your or others&apos; vital interests.</li>
                </ul>
              </Section>

              <Section id="share" title="4. When and With Whom Do We Share Your Personal Information?">
                <p className="text-sm italic text-gray-500">
                  In Short: We may share information in specific situations described in this section.
                </p>
                <p>We do not sell your personal information. We share information with service providers that help us run the Service, including:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Supabase</strong> — authentication, database, and related infrastructure;</li>
                  <li><strong>Google</strong> — sign-in and cloud services used for speech synthesis or image generation;</li>
                  <li><strong>Stripe</strong> — payments and subscription billing;</li>
                  <li><strong>PostHog</strong> — product analytics;</li>
                  <li><strong>AI model providers (e.g. DeepSeek)</strong> — powering language learning features such as chat and journey generation;</li>
                  <li>Professional advisers, regulators, or others when required by law or to protect rights and safety.</li>
                </ul>
                <p>
                  <strong>Business Transfers:</strong> We may share or transfer your information in connection with, or
                  during negotiations of, any merger, sale, financing, or acquisition of all or a portion of our business.
                </p>
              </Section>

              <Section id="cookies" title="5. Do We Use Cookies and Other Tracking Technologies?">
                <p className="text-sm italic text-gray-500">
                  In Short: We may use cookies and other tracking technologies to collect and store your information.
                </p>
                <p>
                  We may use cookies and similar tracking technologies (like web beacons and pixels) to keep you signed
                  in, remember preferences, measure performance, and prevent fraud. You can control cookies through your
                  browser settings; disabling cookies may limit some features of the Services.
                </p>
              </Section>

              <Section id="international" title="6. Is Your Information Transferred Internationally?">
                <p className="text-sm italic text-gray-500">
                  In Short: We may transfer, store, and process your information in countries other than your own.
                </p>
                <p>
                  Our servers are located in the United States. If you are accessing our Services from outside the United
                  States, please be aware that your information may be transferred to, stored in, and processed by us and
                  our third-party service providers in the United States and other countries. Those countries may have
                  different data protection laws than your country of residence.
                </p>
              </Section>

              <Section id="retention" title="7. How Long Do We Keep Your Information?">
                <p className="text-sm italic text-gray-500">
                  In Short: We keep your information for as long as necessary to fulfill the purposes outlined in this
                  privacy notice unless otherwise required by law.
                </p>
                <p>
                  We retain information for as long as your account is active and as needed to provide the Services,
                  comply with legal obligations, resolve disputes, and enforce our agreements. When we have no ongoing
                  legitimate business need to process your personal information, we will either delete or anonymize it.
                  You may request deletion of your account data as described below.
                </p>
              </Section>

              <Section id="jurisdiction" title="8. Jurisdiction-Specific Provisions">
                <Sub title="United States">
                  <p>
                    If you are a consumer located in the United States, we process your personal information in
                    accordance with US federal and state privacy laws.
                  </p>
                  <p><strong>Your Rights and Choices.</strong> As a US consumer and subject to certain limitations under US privacy laws, you may have the following rights:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Right to know:</strong> You may request information about the categories and specific pieces of personal information we have collected about you.</li>
                    <li><strong>Right to delete:</strong> You may request that we delete personal information we have collected from you, subject to certain exceptions.</li>
                    <li><strong>Right to correct:</strong> You may request that we correct inaccurate personal information we hold about you.</li>
                    <li><strong>Right to opt-out:</strong> We do not sell your personal information. However, certain sharing with analytics providers may qualify as &ldquo;sharing&rdquo; under applicable US privacy laws.</li>
                    <li><strong>Right to non-discrimination:</strong> We will not discriminate against you for exercising any of your privacy rights.</li>
                    <li><strong>Appeal:</strong> If you wish to appeal any of our decisions regarding a rights request, you may do so by contacting us at{" "}
                      <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{email}</a>.
                    </li>
                  </ul>
                  <p>
                    To submit a request to exercise any of the rights described above, please contact us using the
                    methods described in the Contact Us section below.
                  </p>
                </Sub>

                <Sub title="EEA and UK">
                  <p>
                    You may exercise your rights by contacting us at{" "}
                    <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{email}</a>.
                    If you are a resident of the EEA and believe our processing of your information contradicts the GDPR,
                    you may direct your questions or complaints to the Irish Data Protection Commission. If you are a
                    resident of the UK, direct your questions or concerns to the UK Information Commissioner&apos;s Office.
                  </p>
                </Sub>

                <Sub title="Canada">
                  <p>
                    When LingoIsland collects personal data belonging to Canadian residents, it transfers that data to
                    data centers in the United States. You have the right to request access or rectification of the
                    personal data LingoIsland holds related to you, or to withdraw any consent given to the processing of
                    such personal data. You may exercise those rights by contacting us at{" "}
                    <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{email}</a>.
                  </p>
                </Sub>

                <Sub title="Australia">
                  <p>
                    &ldquo;Personal Data&rdquo; includes &ldquo;personal information&rdquo; as defined under applicable
                    privacy laws in Australia, including the Privacy Act 1988 (Cth). If you are an Australian resident
                    and dissatisfied with our handling of any complaint, you may consider contacting the Office of the
                    Australian Information Commissioner.
                  </p>
                </Sub>
              </Section>

              <Section id="safe" title="9. How Do We Keep Your Information Safe?">
                <p className="text-sm italic text-gray-500">
                  In Short: We aim to protect your personal information through a system of organizational and technical
                  security measures.
                </p>
                <p>
                  We use administrative, technical, and organizational measures designed to protect information against
                  unauthorized access, loss, misuse, or alteration. No method of transmission over the Internet or
                  method of electronic storage is 100% secure; we cannot guarantee absolute security.
                </p>
              </Section>

              <Section id="rights" title="10. What Are Your Privacy Rights?">
                <p className="text-sm italic text-gray-500">
                  In Short: In some regions, such as the EEA, UK, and Canada, you have rights that allow you greater
                  access to and control over your personal information.
                </p>
                <p>
                  Depending on where you live, you may have rights to access, correct, delete, or export personal
                  information, or to object to or restrict certain processing. You may also have the right to lodge a
                  complaint with a supervisory authority. To exercise rights that apply to you, contact us using the
                  details in the Contact section below. We may need to verify your identity before fulfilling your
                  request.
                </p>
                <p>
                  <strong>Withdrawing your consent:</strong> If we are relying on your consent to process your personal
                  information, you have the right to withdraw that consent at any time by contacting us at{" "}
                  <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{email}</a>.
                </p>
                <p>
                  <strong>Account Information:</strong> You may at any time review or change the information in your
                  account by logging into your account settings. Upon your request to terminate your account, we will
                  deactivate or delete your account and information from our active databases.
                </p>
              </Section>

              <Section id="dnt" title="11. Controls for Do-Not-Track Features">
                <p>
                  Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track
                  (&ldquo;DNT&rdquo;) feature or setting you can activate to signal your privacy preference not to have
                  data about your online browsing activities monitored and collected. At this stage, no uniform
                  technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not
                  currently respond to DNT browser signals or any other mechanism that automatically communicates your
                  choice not to be tracked online.
                </p>
              </Section>

              <Section id="california" title="12. Do California Residents Have Specific Privacy Rights?">
                <p className="text-sm italic text-gray-500">
                  In Short: Yes, if you are a resident of California, you are granted specific rights regarding access to
                  your personal information.
                </p>
                <p>
                  California Civil Code Section 1798.83 permits our users who are California residents to request and
                  obtain from us, once a year and free of charge, information about categories of personal information
                  (if any) we disclosed to third parties for direct marketing purposes and the names and addresses of all
                  third parties with which we shared personal information in the immediately preceding calendar year. If
                  you are a California resident and would like to make such a request, please submit your request in
                  writing to us using the contact information provided below.
                </p>
              </Section>

              <Section id="updates" title="13. Do We Make Updates to This Notice?">
                <p className="text-sm italic text-gray-500">
                  In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws.
                </p>
                <p>
                  We may update this privacy notice from time to time. The updated version will be indicated by an
                  updated &ldquo;Last Updated&rdquo; date and the updated version will be effective as soon as it is
                  accessible. We encourage you to review this privacy notice frequently to be informed of how we are
                  protecting your information.
                </p>
              </Section>

              <Section id="contact" title="14. How Can You Contact Us About This Notice?">
                <p>
                  If you have questions or comments about this notice, you may email us at{" "}
                  <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">
                    {email}
                  </a>{" "}
                  or visit our{" "}
                  <Link href="/contact" className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">
                    Contact page
                  </Link>
                  .
                </p>
              </Section>

              <Section id="delete" title="15. How Can You Review, Update, or Delete the Data We Collect From You?">
                <p>
                  Based on the applicable laws of your country, you may have the right to request access to the personal
                  information we collect from you, change that information, or delete it. To request to review, update,
                  or delete your personal information, please email{" "}
                  <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">
                    {email}
                  </a>{" "}
                  with your request. We will respond to your request within 30 days.
                </p>
              </Section>

            </div>
          </div>
        </article>

        <Footer />
      </div>
    </main>
  );
}
