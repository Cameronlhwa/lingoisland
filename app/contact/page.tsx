"use client";

import { useState } from "react";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { OceanBackground } from "@/components/OceanBackground";

const email = "cameron@lingoisland.com";

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
    <main className="relative min-h-screen">
      <OceanBackground />
      <div className="relative z-10">
        <Nav />

        <div className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
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
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">Contact Us</h1>
            <p className="mt-3 text-[15px] text-gray-600 leading-relaxed">
              Have a question, feedback, or need help? We&apos;d love to hear from you. Fill out the form below or
              email us directly at{" "}
              <a href={`mailto:${email}`} className="font-medium text-[#0B1B3A] underline-offset-2 hover:underline">
                {email}
              </a>
              .
            </p>

            {/* Contact cards */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1B3A]/10">
                  <svg className="h-5 w-5 text-[#0B1B3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900">Email</p>
                <a href={`mailto:${email}`} className="mt-1 block text-sm text-[#0B1B3A] underline-offset-2 hover:underline">
                  {email}
                </a>
                <p className="mt-1 text-xs text-gray-500">We typically reply within 1–2 business days.</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1B3A]/10">
                  <svg className="h-5 w-5 text-[#0B1B3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900">Privacy &amp; Terms</p>
                <div className="mt-1 flex flex-col gap-0.5">
                  <Link href="/privacy" className="text-sm text-[#0B1B3A] underline-offset-2 hover:underline">Privacy Policy</Link>
                  <Link href="/terms" className="text-sm text-[#0B1B3A] underline-offset-2 hover:underline">Terms of Service</Link>
                </div>
              </div>
            </div>

            {/* Contact form */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-[#0B1B3A] focus:outline-none focus:ring-2 focus:ring-[#0B1B3A]/20"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-[#0B1B3A] focus:outline-none focus:ring-2 focus:ring-[#0B1B3A]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                  Subject
                </label>
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is this about?"
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-[#0B1B3A] focus:outline-none focus:ring-2 focus:ring-[#0B1B3A]/20"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us how we can help..."
                  className="mt-1.5 block w-full resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-[#0B1B3A] focus:outline-none focus:ring-2 focus:ring-[#0B1B3A]/20"
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
                className="inline-flex items-center gap-2 rounded-lg bg-[#0B1B3A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#162d5c] focus:outline-none focus:ring-2 focus:ring-[#0B1B3A] focus:ring-offset-2 disabled:opacity-60"
              >
                Send Message
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>

              <p className="text-xs text-gray-400">
                By submitting this form, you agree to our{" "}
                <Link href="/privacy" className="underline underline-offset-2 hover:text-gray-600">Privacy Policy</Link>.
              </p>
            </form>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}
