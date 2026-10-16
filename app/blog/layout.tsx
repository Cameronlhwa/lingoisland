import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lingo-home flex min-h-screen flex-col">
      <Nav />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
