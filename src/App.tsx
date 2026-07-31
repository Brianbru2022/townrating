import { useExplorerStore, type AppMode } from './app/store';
import { FeatureDetails } from './components/FeatureDetails';
import { InformationPage } from './components/InformationPage';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { MapCanvas } from './map/MapCanvas';

const nav: { id: AppMode; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'sources', label: 'Sources & licences' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'data-review', label: 'Data review' },
];
export default function App() {
  const mode = useExplorerStore((state) => state.mode);
  const setMode = useExplorerStore((state) => state.setMode);
  return (
    <div className="app">
      <header>
        <button className="skip" onClick={() => setMode('explore')}>
          Historic Town Explorer
        </button>
        <nav>
          {nav.map((item) => (
            <button
              className={mode === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      {mode === 'explore' ? (
        <main className="explorer">
          <Sidebar />
          <MapCanvas />
          <FeatureDetails />
          <Timeline />
        </main>
      ) : (
        <InformationPage />
      )}
    </div>
  );
}
