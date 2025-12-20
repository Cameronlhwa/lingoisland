export default function DailyHubPreview() {
  // Generate mock calendar heatmap data (last 4 weeks)
  const weeks = 4;
  const daysPerWeek = 7;
  const getRandomIntensity = () => Math.floor(Math.random() * 4); // 0-3 for intensity levels

  const heatmapData = Array.from({ length: weeks * daysPerWeek }, () =>
    getRandomIntensity()
  );

  const getColorClass = (intensity: number) => {
    switch (intensity) {
      case 0:
        return "bg-gray-100";
      case 1:
        return "bg-gray-300";
      case 2:
        return "bg-gray-500";
      case 3:
        return "bg-gray-900";
      default:
        return "bg-gray-100";
    }
  };

  return (
    <section className="border-y border-gray-100 bg-white px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            Practice calendar
          </h2>
          <p className="text-lg text-gray-600">
            See your consistency. Each square is a day you reviewed.
          </p>
        </div>

        <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="grid grid-cols-7 gap-2">
            {heatmapData.map((intensity, index) => (
              <div
                key={index}
                className={`aspect-square rounded-lg ${getColorClass(
                  intensity
                )} transition-transform hover:scale-110`}
                title={`Day ${index + 1}`}
              ></div>
            ))}
          </div>
          <div className="mt-8 flex items-center justify-center gap-4 text-sm text-gray-600">
            <span>Less</span>
            <div className="flex gap-1.5">
              <div className="h-4 w-4 rounded-lg bg-gray-100"></div>
              <div className="h-4 w-4 rounded-lg bg-gray-300"></div>
              <div className="h-4 w-4 rounded-lg bg-gray-500"></div>
              <div className="h-4 w-4 rounded-lg bg-gray-900"></div>
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </section>
  );
}
