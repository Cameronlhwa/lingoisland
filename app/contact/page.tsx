"use client";

import { useState } from "react";
import Link from "next/link";

const email = "ourlingoisland@gmail.com";

type FormState = "idle" | "sending" | "success" | "error";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Compose a mailto link as a simple contact mechanism
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${userEmail}\n\n${message}`
    );
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject || "LingoIsland Inquiry")}&body=${body}`;
    window.location.href = mailtoUrl;
    setFormState("success");
  }

  return (
    <main className="marketing-contact relative min-h-screen">
      <div className="relative z-10">

        <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#766554] transition-colors hover:text-[#60371f] focus:outline-none focus:ring-2 focus:ring-[#617b3c] focus:ring-offset-2 rounded"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>

          <div className="marketing-paper px-6 py-8 md:px-10 md:py-10">
            <h1 className="text-3xl font-semibold tracking-tight text-[#60371f] md:text-4xl">Contact Us</h1>
            <p className="mt-3 text-base text-[#766554] leading-relaxed">
              Have a question, feedback, or need help? We&apos;d love to hear from you. Fill out the form below or
              email us directly at{" "}
              <a href={`mailto:${email}`} className="font-medium text-[#617b3c] underline-offset-2 hover:underline">
                {email}
              </a>
              .
            </p>

            {/* Contact cards */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#eadfce] bg-[#f5f0e6] p-5">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#617b3c]/10">
                  <svg className="h-5 w-5 text-[#617b3c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[#60371f]">Email</p>
                <a href={`mailto:${email}`} className="mt-1 block text-sm text-[#617b3c] underline-offset-2 hover:underline">
                  {email}
                </a>
                <p className="mt-1 text-xs text-[#82725f]">We typically reply within 1–2 business days.</p>
              </div>

              <div className="rounded-xl border border-[#eadfce] bg-[#f5f0e6] p-5">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#617b3c]/10">
                  <svg className="h-5 w-5 text-[#617b3c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[#60371f]">Privacy &amp; Terms</p>
                <div className="mt-1 flex flex-col gap-0.5">
                  <Link href="/privacy" className="text-sm text-[#617b3c] underline-offset-2 hover:underline">Privacy Policy</Link>
                  <Link href="/terms" className="text-sm text-[#617b3c] underline-offset-2 hover:underline">Terms of Service</Link>
                </div>
              </div>
            </div>

            {/* Contact form */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-[#766554]">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="mt-1.5 block w-full rounded-lg border border-[#d8c8b3] bg-white px-3.5 py-2.5 text-sm text-[#60371f] placeholder-[#958779] shadow-sm transition focus:border-[#617b3c] focus:outline-none focus:ring-2 focus:ring-[#617b3c]/20"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#766554]">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5 block w-full rounded-lg border border-[#d8c8b3] bg-white px-3.5 py-2.5 text-sm text-[#60371f] placeholder-[#958779] shadow-sm transition focus:border-[#617b3c] focus:outline-none focus:ring-2 focus:ring-[#617b3c]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-[#766554]">
                  Subject
                </label>
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is this about?"
                  className="mt-1.5 block w-full rounded-lg border border-[#d8c8b3] bg-white px-3.5 py-2.5 text-sm text-[#60371f] placeholder-[#958779] shadow-sm transition focus:border-[#617b3c] focus:outline-none focus:ring-2 focus:ring-[#617b3c]/20"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-[#766554]">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us how we can help..."
                  className="mt-1.5 block w-full resize-none rounded-lg border border-[#d8c8b3] bg-white px-3.5 py-2.5 text-sm text-[#60371f] placeholder-[#958779] shadow-sm transition focus:border-[#617b3c] focus:outline-none focus:ring-2 focus:ring-[#617b3c]/20"
                />
              </div>

              {formState === "success" && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                  Your email client should have opened. If it didn&apos;t, please email us directly at{" "}
                  <a href={`mailto:${email}`} className="font-medium underline underline-offset-2">{email}</a>.
                </div>
              )}

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-[#617b3c] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#526b30] focus:outline-none focus:ring-2 focus:ring-[#617b3c] focus:ring-offset-2 disabled:opacity-60"
              >
                Send Message
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>

              <p className="text-xs text-[#82725f]">
                By submitting this form, you agree to our{" "}
                <Link href="/privacy" className="underline underline-offset-2 hover:text-[#766554]">Privacy Policy</Link>.
              </p>
            </form>
          </div>
        </div>

      </div>
    </main>
  );
}
