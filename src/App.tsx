import { useState } from 'react';
import { useExplorerStore, type AppMode } from './app/store';
import { FeatureDetails } from './components/FeatureDetails';
import { InformationPage } from './components/InformationPage';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { HomeMap } from './map/HomeMap';
import { MapCanvas } from './map/MapCanvas';
import { appBrandName } from './app/brand';

const primaryNav: { id: AppMode; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'explore', label: 'Explore' },
];

const supportNav: { id: AppMode; label: string }[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'methodology', label: 'How it works' },
  ...(import.meta.env.DEV ? [{ id: 'data-review' as const, label: 'Curator tools' }] : []),
];

function NavIcon({ id }: { id: AppMode }) {
  if (id === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 11 8-7 8 7" />
        <path d="M6.5 10.5V20h11v-9.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 19.5 8 6l5-1.5 6.5 2-3.5 13.5-5-1.5z" />
      <path d="M8 6l3 12.5" />
      <path d="m13 4.5 3 15.5" />
    </svg>
  );
}

export default function App() {
  const [supportOpen, setSupportOpen] = useState(false);
  const mode = useExplorerStore((state) => state.mode);
  const setMode = useExplorerStore((state) => state.setMode);
  const showHistoryTimeline = useExplorerStore((state) => state.showHistoryTimeline);
  const exploreMapStyle = useExplorerStore((state) => state.exploreMapStyle);
  const supportActive = supportNav.some((item) => item.id === mode);
  const supportTitle = import.meta.env.DEV
    ? 'Sources, methodology and curator tools'
    : 'Sources and methodology';

  function changeMode(nextMode: AppMode) {
    setMode(nextMode);
    setSupportOpen(false);
  }

  return (
    <div className="app">
      <header className="app-masthead">
        <button
          className="brand-lockup"
          aria-label={appBrandName}
          onClick={() => changeMode('home')}
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="15" />
              <path d="m20 7 3.3 9.7L33 20l-9.7 3.3L20 33l-3.3-9.7L7 20l9.7-3.3z" />
              <path d="M20 13v14M13 20h14" />
            </svg>
          </span>
          <span className="brand-text">
            <span>Townscape</span>
            <strong>Guides</strong>
          </span>
        </button>
        <nav aria-label="Main navigation">
          {primaryNav.map((item) => (
            <button
              className={mode === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => changeMode(item.id)}
            >
              <NavIcon id={item.id} />
              {item.label}
            </button>
          ))}
          <div className="support-nav">
            <button
              type="button"
              className={supportActive || supportOpen ? 'support-trigger active' : 'support-trigger'}
              aria-label="About"
              aria-expanded={supportOpen}
              title={supportTitle}
              onClick={() => setSupportOpen((open) => !open)}
            >
              <span aria-hidden="true">i</span>
              <span>About</span>
            </button>
            {supportOpen && (
              <div className="support-menu" role="menu">
                {supportNav.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={mode === item.id ? 'active' : ''}
                    role="menuitem"
                    onClick={() => changeMode(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </header>
      {mode === 'home' ? (
        <HomeMap />
      ) : mode === 'explore' ? (
        <main className="explorer">
          <Sidebar />
          <MapCanvas key={exploreMapStyle} />
          <FeatureDetails />
          {showHistoryTimeline && <Timeline />}
        </main>
      ) : (
        <InformationPage />
      )}
    </div>
  );
}
