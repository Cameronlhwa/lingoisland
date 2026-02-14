# Progress Island 7-Day Activity Tracker

## Implementation Summary

Added a 7-day flashcard activity tracker to the "Your Progress Island" section on the home dashboard. The tracker displays visual squares showing the user's review activity over the past 7 days.

## Changes Made

### File: `components/app/HomeDashboard.tsx`

#### 1. Added State for 7-Day Activity
```typescript
const [last7DaysActivity, setLast7DaysActivity] = useState<{ date: string; count: number }[]>([]);
```

#### 2. Updated `loadTodayReviewCount` Function
Extended the existing function to calculate and store the last 7 days of activity:
- Fetches monthly activity data from `/api/quiz-activity`
- Extracts today's review count (existing functionality)
- **NEW**: Builds a 7-day array with review counts for each day
- Handles missing days by filling with count of 0

```typescript
// Get last 7 days of activity
const activityMap = new Map<string, number>();
(data.activity || []).forEach((entry: { date: string; count: number }) => {
  activityMap.set(entry.date, entry.count);
});

const last7Days: { date: string; count: number }[] = [];
for (let i = 6; i >= 0; i--) {
  const date = new Date(now);
  date.setDate(date.getDate() - i);
  const dateKey = date.toISOString().split('T')[0];
  last7Days.push({
    date: dateKey,
    count: activityMap.get(dateKey) || 0,
  });
}
setLast7DaysActivity(last7Days);
```

#### 3. Added Visual Activity Tracker UI
Integrated 7 squares on the right side of the "Your Progress Island" title/subtitle area:

**Layout:**
- Positioned on the right side using flexbox (`justify-between`)
- Contains label "Last 7 days" above the squares
- Squares arranged horizontally with gap spacing

**Visual Design:**
- 8x8 square size (`h-8 w-8`)
- Rounded corners
- Color intensity based on review count:
  - 0 cards: `bg-slate-100` (light gray, no activity)
  - 1-4 cards: `bg-emerald-300` (light green)
  - 5-9 cards: `bg-emerald-400` (medium-light green)
  - 10-19 cards: `bg-emerald-500` (medium green)
  - 20+ cards: `bg-emerald-600` (dark green)
- Today's square has a dark ring indicator (`ring-2 ring-slate-900`)
- Hover effect: scales up slightly (`hover:scale-110`)

**Interactivity:**
- Tooltip shows date and card count on hover
- Example: "Feb 13: 15 cards reviewed"

**Code Structure:**
```tsx
{/* Last 7 days activity squares */}
{!islandLoading && last7DaysActivity.length > 0 && (
  <div className="flex flex-col items-end gap-1.5">
    <p className="text-xs font-medium text-slate-600">Last 7 days</p>
    <div className="flex gap-1.5">
      {last7DaysActivity.map((day, index) => {
        const isToday = index === last7DaysActivity.length - 1;
        const count = day.count;
        
        // Color intensity logic
        let bgColor = 'bg-slate-100';
        if (count >= 20) bgColor = 'bg-emerald-600';
        else if (count >= 10) bgColor = 'bg-emerald-500';
        else if (count >= 5) bgColor = 'bg-emerald-400';
        else if (count > 0) bgColor = 'bg-emerald-300';
        
        return (
          <div
            key={day.date}
            className={`h-8 w-8 rounded ${bgColor} ${
              isToday ? 'ring-2 ring-slate-900' : ''
            } transition-all hover:scale-110`}
            title={`${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${count} cards reviewed`}
          />
        );
      })}
    </div>
  </div>
)}
```

## User Experience

### Desktop View
- 7 squares displayed horizontally on the right side of the title area
- Provides quick visual feedback on study consistency
- Does not interfere with existing title/subtitle content

### Mobile View
- Responsive layout maintains readability
- Squares remain visible but may wrap if needed on very small screens

### Loading State
- Activity tracker only shows after data is loaded (`!islandLoading`)
- Prevents layout shift during initial page load

## Data Flow

1. **Component Mount** → `useEffect` calls `loadTodayReviewCount()`
2. **API Call** → Fetches `/api/quiz-activity` for current month
3. **Data Processing** → Extracts last 7 days with counts
4. **State Update** → `setLast7DaysActivity()` triggers re-render
5. **UI Render** → 7 colored squares displayed with tooltips

## Color Scale Reference

| Review Count | Color | Tailwind Class | Visual |
|--------------|-------|----------------|--------|
| 0 | Light Gray | `bg-slate-100` | □ |
| 1-4 | Light Green | `bg-emerald-300` | ▢ |
| 5-9 | Medium-Light Green | `bg-emerald-400` | ▣ |
| 10-19 | Medium Green | `bg-emerald-500` | ▦ |
| 20+ | Dark Green | `bg-emerald-600` | ■ |

## Future Enhancements (Optional)

- Add week-over-week comparison
- Show streak count next to the squares
- Add click interaction to show daily breakdown
- Animate squares when data updates
- Add confetti effect for high-activity days
