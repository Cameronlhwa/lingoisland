import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#D6EEF8" }}>
      <Nav />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
