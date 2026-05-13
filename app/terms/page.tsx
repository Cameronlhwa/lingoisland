import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { OceanBackground } from "@/components/OceanBackground";

const LAST_UPDATED = "May 11, 2026";
const email = "cameron@lingoisland.com";
const site = "https://lingoisland.com";

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 space-y-3">
      <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsOfServicePage() {
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
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">Terms of Service</h1>
            <p className="mt-2 text-sm text-gray-500">Last Updated: {LAST_UPDATED}</p>

            <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-gray-700">
              <p>
                We are LingoIsland (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;).
              </p>
              <p>
                We operate the website{" "}
                <a href={site} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{site}</a>{" "}
                (the &ldquo;Site&rdquo;), as well as any other related products and services that refer or link to these
                legal terms (collectively, the &ldquo;Services&rdquo;).
              </p>
              <p>
                We provide an AI-powered language learning platform that helps users learn Mandarin and other languages
                through personalized topic islands, vocabulary journeys, quizzes, and interactive chat.
              </p>
              <p>
                You can contact us by email at{" "}
                <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{email}</a>.
              </p>
              <p>
                These Legal Terms constitute a legally binding agreement made between you, whether personally or on
                behalf of an entity (&ldquo;you&rdquo;), and LingoIsland, concerning your access to and use of the
                Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by
                all of these Legal Terms.{" "}
                <strong>
                  IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE
                  SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.
                </strong>
              </p>
              <p>
                We reserve the right, in our sole discretion, to make changes or modifications to these Legal Terms at
                any time and for any reason. We will alert you about any changes by updating the &ldquo;Last
                Updated&rdquo; date of these Legal Terms. It is your responsibility to periodically review these Legal
                Terms to stay informed of updates. Your continued use of the Services after the date such revised Legal
                Terms are posted constitutes your acceptance of those changes.
              </p>
              <p>
                All users who are minors in the jurisdiction in which they reside (generally under the age of 13) must
                have the permission of, and be directly supervised by, their parent or guardian to use the Services. If
                you are a minor, you must have your parent or guardian read and agree to these Legal Terms prior to you
                using the Services.
              </p>
            </div>

            <div className="mt-8 space-y-1 text-[15px] leading-relaxed text-gray-700">

              <Section id="services" title="1. Our Services">
                <p>
                  LingoIsland provides an AI-powered language learning platform. The information provided when using the
                  Services is not intended for distribution to or use by any person or entity in any jurisdiction or
                  country where such distribution or use would be contrary to law or regulation.
                </p>
                <p>
                  The Services are not tailored to comply with industry-specific regulations (Health Insurance
                  Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA),
                  etc.), so if your interactions would be subjected to such laws, you may not use the Services.
                </p>
              </Section>

              <Section id="ip" title="2. Intellectual Property Rights">
                <p><strong>Our intellectual property</strong></p>
                <p>
                  We are the owner or the licensee of all intellectual property rights in our Services, including all
                  source code, databases, functionality, software, website designs, audio, video, text, photographs, and
                  graphics in the Services (collectively, the &ldquo;Content&rdquo;), as well as the trademarks,
                  service marks, and logos contained therein (the &ldquo;Marks&rdquo;).
                </p>
                <p>
                  Our Content and Marks are protected by copyright and trademark laws in the United States and around
                  the world. The Content and Marks are provided in or through the Services &ldquo;AS IS&rdquo; for your
                  personal, non-commercial use or internal business purpose only.
                </p>
                <p><strong>Your use of our Services</strong></p>
                <p>
                  Subject to your compliance with these Legal Terms, we grant you a non-exclusive, non-transferable,
                  revocable license to access the Services and download or print a copy of any portion of the Content to
                  which you have properly gained access, solely for your personal, non-commercial use or internal
                  business purpose.
                </p>
                <p>
                  Except as set out in this section, no part of the Services and no Content or Marks may be copied,
                  reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated,
                  transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose
                  whatsoever, without our express prior written permission.
                </p>
                <p>
                  Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms
                  and your right to use our Services will terminate immediately.
                </p>
                <p><strong>Your submissions and contributions</strong></p>
                <p>
                  By directly sending us any question, comment, suggestion, idea, feedback, or other information about
                  the Services (&ldquo;Submissions&rdquo;), you agree to assign to us all intellectual property rights
                  in such Submission. You agree that we shall own this Submission and be entitled to its unrestricted
                  use and dissemination for any lawful purpose, commercial or otherwise, without acknowledgment or
                  compensation to you.
                </p>
                <p>
                  We may remove or edit your content at any time without notice if in our reasonable opinion we consider
                  it harmful or in breach of these Legal Terms.
                </p>
              </Section>

              <Section id="representations" title="3. User Representations">
                <p>By using the Services, you represent and warrant that:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>All registration information you submit will be true, accurate, current, and complete;</li>
                  <li>You will maintain the accuracy of such information and promptly update it as necessary;</li>
                  <li>You have the legal capacity and you agree to comply with these Legal Terms;</li>
                  <li>You are not a minor in the jurisdiction in which you reside, or if a minor, you have received parental permission to use the Services;</li>
                  <li>You will not access the Services through automated or non-human means, whether through a bot, script, or otherwise;</li>
                  <li>You will not use the Services for any illegal or unauthorized purpose; and</li>
                  <li>Your use of the Services will not violate any applicable law or regulation.</li>
                </ul>
                <p>
                  If you provide any information that is untrue, inaccurate, not current, or incomplete, we have the
                  right to suspend or terminate your account and refuse any and all current or future use of the
                  Services.
                </p>
              </Section>

              <Section id="registration" title="4. User Registration">
                <p>
                  You may be required to register to use the Services. You agree to keep your password confidential and
                  will be responsible for all use of your account and password. We reserve the right to remove, reclaim,
                  or change a username you select if we determine, in our sole discretion, that such username is
                  inappropriate, obscene, or otherwise objectionable.
                </p>
              </Section>

              <Section id="payment" title="5. Purchases and Payment">
                <p>We accept the following forms of payment: Visa, Mastercard, American Express, Discover.</p>
                <p>
                  You agree to provide current, complete, and accurate purchase and account information for all
                  purchases made via the Services. You further agree to promptly update account and payment information,
                  including email address, payment method, and payment card expiration date, so that we can complete
                  your transactions and contact you as needed. All payments shall be in US dollars unless otherwise
                  stated at checkout.
                </p>
                <p>
                  You agree to pay all charges at the prices then in effect for your purchases, and you authorize us to
                  charge your chosen payment provider for any such amounts upon placing your order. If your order is
                  subject to recurring charges, then you consent to our charging your payment method on a recurring
                  basis without requiring your prior approval for each recurring charge, until such time as you cancel
                  the applicable subscription.
                </p>
                <p>
                  We reserve the right to refuse any order placed through the Services. We may change prices at any
                  time; such changes will take effect at the next billing cycle for existing subscribers.
                </p>
              </Section>

              <Section id="cancellation" title="6. Cancellation">
                <p>
                  You can cancel your subscription at any time by logging into your account, going to settings, and
                  clicking on the billing section. Your cancellation will take effect at the end of the current paid
                  term, and you will continue to have access to the Services until then.
                </p>
                <p>
                  If you are unsatisfied with our Services, please email us at{" "}
                  <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{email}</a>.
                </p>
              </Section>

              <Section id="prohibited" title="7. Prohibited Activities">
                <p>
                  You may not access or use the Services for any purpose other than that for which we make the Services
                  available. As a user of the Services, you agree not to:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Systematically retrieve data or other content from the Services to create or compile a collection, compilation, database, or directory without written permission from us.</li>
                  <li>Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.</li>
                  <li>Circumvent, disable, or otherwise interfere with security-related features of the Services.</li>
                  <li>Use any information obtained from the Services in order to harass, abuse, or harm another person.</li>
                  <li>Use the Services in a manner inconsistent with any applicable laws or regulations.</li>
                  <li>Upload or transmit viruses, Trojan horses, or other malicious material.</li>
                  <li>Engage in any automated use of the system, such as using scripts, bots, data mining tools, or similar data gathering and extraction tools.</li>
                  <li>Attempt to impersonate another user or person.</li>
                  <li>Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.</li>
                  <li>Attempt to decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services.</li>
                  <li>Make any unauthorized use of the Services, including collecting email addresses of users by electronic or other means for the purpose of sending unsolicited email.</li>
                  <li>Use the Services as part of any effort to compete with us or otherwise use the Services for any revenue-generating endeavor without our express permission.</li>
                  <li>Use the Services for academic dishonesty, plagiarism, or circumventing institutional guidelines. LingoIsland is designed for authentic language learning and we firmly oppose misuse of our platform.</li>
                  <li>Sell or otherwise transfer your profile or account.</li>
                </ul>
              </Section>

              <Section id="ugc" title="8. User Generated Contributions">
                <p>
                  The Services may invite you to chat, contribute to, or participate in features, and may provide you
                  with the opportunity to create, submit, post, or transmit content and materials to us or on the
                  Services, including but not limited to text, comments, suggestions, or personal information
                  (collectively, &ldquo;Contributions&rdquo;). Contributions may be viewable by other users of the
                  Services.
                </p>
                <p>When you create or make available any Contributions, you represent and warrant that:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Your Contributions do not infringe the proprietary rights of any third party.</li>
                  <li>You are the creator and owner of or have the necessary licenses and permissions to use your Contributions.</li>
                  <li>Your Contributions are not false, inaccurate, or misleading.</li>
                  <li>Your Contributions are not unsolicited advertising, promotional materials, spam, or other forms of solicitation.</li>
                  <li>Your Contributions are not obscene, lewd, harassing, libelous, or otherwise objectionable.</li>
                  <li>Your Contributions do not violate any applicable law, regulation, or rule.</li>
                  <li>Your Contributions do not violate the privacy or publicity rights of any third party.</li>
                </ul>
              </Section>

              <Section id="license" title="9. Contribution License">
                <p>
                  By posting your Contributions to any part of the Services, you grant us an unrestricted, unlimited,
                  irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right and
                  license to host, use, copy, reproduce, disclose, sell, publish, broadcast, store, publicly perform,
                  publicly display, reformat, translate, transmit, and distribute such Contributions for any purpose,
                  commercial or otherwise, and to prepare derivative works of, or incorporate into other works, such
                  Contributions.
                </p>
                <p>
                  We do not assert any ownership over your Contributions. You retain full ownership of all of your
                  Contributions and any intellectual property rights associated with them. We are not liable for any
                  statements or representations in your Contributions.
                </p>
                <p>
                  We have the right, in our sole and absolute discretion, to edit, redact, or otherwise change any
                  Contributions, or to pre-screen or delete any Contributions at any time and for any reason, without
                  notice.
                </p>
              </Section>

              <Section id="thirdparty" title="10. Third-Party Websites and Content">
                <p>
                  The Services may contain links to other websites (&ldquo;Third-Party Websites&rdquo;) as well as
                  articles, text, graphics, and other content or items belonging to or originating from third parties.
                  Such Third-Party Websites and content are not investigated, monitored, or checked for accuracy,
                  appropriateness, or completeness by us, and we are not responsible for any Third-Party Websites or
                  content accessed through the Services.
                </p>
              </Section>

              <Section id="management" title="11. Services Management">
                <p>
                  We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these
                  Legal Terms; (2) take appropriate legal action against anyone who violates the law or these Legal
                  Terms; (3) refuse, restrict access to, or limit the availability of any of your Contributions; (4)
                  remove from the Services or otherwise disable all files and content that are excessive in size or are
                  in any way burdensome to our systems; and (5) otherwise manage the Services in a manner designed to
                  protect our rights and property.
                </p>
              </Section>

              <Section id="privacy-policy" title="12. Privacy Policy">
                <p>
                  We care about data privacy and security. Please review our{" "}
                  <Link href="/privacy" className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">
                    Privacy Policy
                  </Link>
                  . By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into
                  these Legal Terms.
                </p>
              </Section>

              <Section id="copyright" title="13. Copyright Infringements">
                <p>
                  We respect the intellectual property rights of others. If you believe that any material available on
                  or through the Services infringes upon any copyright you own or control, please notify us immediately
                  at{" "}
                  <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{email}</a>.
                </p>
              </Section>

              <Section id="termination" title="14. Term and Termination">
                <p>
                  These Legal Terms shall remain in full force and effect while you use the Services. We reserve the
                  right, in our sole discretion and without notice or liability, to deny access to and use of the
                  Services to any person for any reason or for no reason, including without limitation for breach of any
                  representation, warranty, or covenant contained in these Legal Terms or of any applicable law or
                  regulation.
                </p>
              </Section>

              <Section id="modifications" title="15. Modifications and Interruptions">
                <p>
                  We reserve the right to change, modify, or remove the contents of the Services at any time or for any
                  reason at our sole discretion without notice. We will not be liable to you or any third party for any
                  modification, price change, suspension, or discontinuance of the Services.
                </p>
              </Section>

              <Section id="law" title="16. Governing Law">
                <p>
                  These Legal Terms and your use of the Services are governed by and construed in accordance with the
                  laws of the State of Delaware, without regard to its conflict of law principles.
                </p>
              </Section>

              <Section id="disputes" title="17. Dispute Resolution">
                <p>
                  To expedite resolution and control the cost of any dispute, controversy, or claim related to these
                  Legal Terms, the Parties agree to first attempt to negotiate any dispute informally for at least
                  thirty (30) days before initiating arbitration. Such informal negotiations commence upon written
                  notice from one Party to the other.
                </p>
                <p><strong>Binding Arbitration</strong></p>
                <p>
                  If the Parties are unable to resolve a dispute through informal negotiations, the dispute will be
                  finally and exclusively resolved by binding arbitration. The arbitration shall be commenced and
                  conducted under the Commercial Arbitration Rules of the American Arbitration Association. The
                  arbitration may be conducted in person, through the submission of documents, by phone, or online.
                </p>
                <p>
                  The Parties agree that any arbitration shall be limited to the dispute between the Parties
                  individually. To the full extent permitted by law, no arbitration shall be joined with any other
                  proceeding.
                </p>
              </Section>

              <Section id="corrections" title="18. Corrections">
                <p>
                  There may be information on the Services that contains typographical errors, inaccuracies, or
                  omissions. We reserve the right to correct any errors, inaccuracies, or omissions and to change or
                  update the information on the Services at any time, without prior notice.
                </p>
              </Section>

              <Section id="disclaimer" title="19. Disclaimer">
                <p>
                  THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES
                  WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES,
                  EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT
                  LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                  NON-INFRINGEMENT.
                </p>
                <p>
                  This AI-powered language learning service enhances learning quality and engagement. Users must
                  exercise ethical judgment and transparency in their content usage. We provide no warranties regarding
                  specific learning outcomes and users assume all risks associated with their use of the Services.
                </p>
              </Section>

              <Section id="liability" title="20. Limitations of Liability">
                <p>
                  IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR
                  ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING
                  LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN
                  IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                </p>
              </Section>

              <Section id="indemnification" title="21. Indemnification">
                <p>
                  You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all
                  of our respective officers, agents, partners, and employees, from and against any loss, damage,
                  liability, claim, or demand, including reasonable attorneys&apos; fees and expenses, made by any third
                  party due to or arising out of: (1) your Contributions; (2) use of the Services; (3) breach of these
                  Legal Terms; (4) any breach of your representations and warranties set forth in these Legal Terms; or
                  (5) your violation of the rights of a third party.
                </p>
              </Section>

              <Section id="userdata" title="22. User Data">
                <p>
                  We will maintain certain data that you transmit to the Services for the purpose of managing the
                  performance of the Services, as well as data relating to your use of the Services. Although we perform
                  regular routine backups of data, you are solely responsible for all data that you transmit or that
                  relates to any activity you have undertaken using the Services.
                </p>
              </Section>

              <Section id="electronic" title="23. Electronic Communications, Transactions, and Signatures">
                <p>
                  Visiting the Services, sending us emails, and completing online forms constitute electronic
                  communications. You consent to receive electronic communications, and you agree that all agreements,
                  notices, disclosures, and other communications we provide to you electronically, via email and on the
                  Services, satisfy any legal requirement that such communication be in writing.
                </p>
              </Section>

              <Section id="refunds" title="24. Refunds">
                <p>
                  Refunds will be provided when required by applicable law. Due to the costly nature of AI services, we
                  are generally unable to issue refunds for purchases made on the Services. If you believe you are
                  entitled to a refund under applicable law or have a special circumstance, please contact us at{" "}
                  <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{email}</a>.
                </p>
              </Section>

              <Section id="misc" title="25. Miscellaneous">
                <p>
                  These Legal Terms and any policies or operating rules posted by us on the Services or in respect to
                  the Services constitute the entire agreement and understanding between you and us. Our failure to
                  exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such
                  right or provision. If any provision or part of a provision of these Legal Terms is determined to be
                  unlawful, void, or unenforceable, that provision or part of the provision is deemed severable from
                  these Legal Terms and does not affect the validity and enforceability of any remaining provisions.
                </p>
              </Section>

              <Section id="contact-tos" title="26. Contact Us">
                <p>
                  In order to resolve a complaint regarding the Services or to receive further information regarding use
                  of the Services, please contact us at:
                </p>
                <p className="mt-2">
                  <strong>LingoIsland</strong>
                  <br />
                  Email:{" "}
                  <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{email}</a>
                  <br />
                  Website:{" "}
                  <a href={site} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">{site}</a>
                </p>
                <p className="mt-2">
                  Or visit our{" "}
                  <Link href="/contact" className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">
                    Contact page
                  </Link>
                  .
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
