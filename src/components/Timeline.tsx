import { useExplorerStore } from '../app/store';

export function Timeline() {
  const pkg = useExplorerStore((state) => state.package);
  const year = useExplorerStore((state) => state.selectedYear);
  const setYear = useExplorerStore((state) => state.setYear);
  const start = pkg.project.timelineStart ?? 1700;
  const end = pkg.project.timelineEnd ?? new Date().getFullYear();
  return (
    <section className="timeline" aria-label="Timeline">
      <label>
        <span>Historic age view</span>
        <output>{year}</output>
        <input
          type="range"
          min={start}
          max={end}
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        />
      </label>
      <p>Move through time to see which mapped historic places were likely visible by that year.</p>
    </section>
  );
}
