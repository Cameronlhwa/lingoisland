export default function SocialProof() {
  const logos = [
    { name: "Tech Review (Placeholder)", className: "font-sans text-gray-400" },
    {
      name: "Language Learning Blog (Placeholder)",
      className: "font-serif text-gray-400",
    },
    {
      name: "Education Weekly (Placeholder)",
      className: "font-sans text-gray-400",
    },
  ];

  return (
    <section className="border-b border-gray-100 bg-white px-6 py-20 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-center font-serif text-lg italic text-gray-500">
          As featured in
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16">
          {logos.map((logo, index) => (
            <div
              key={index}
              className={`text-xl ${logo.className} opacity-50 transition-opacity hover:opacity-70`}
            >
              {logo.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
