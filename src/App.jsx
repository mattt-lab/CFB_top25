import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Top25Tracker from './pages/Top25Tracker.jsx';
import PlayoffWatch from './pages/PlayoffWatch.jsx';
import TeamDetail from './pages/TeamDetail.jsx';
import Conferences from './pages/Conferences.jsx';
import ConferenceDetail from './pages/ConferenceDetail.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Top25Tracker />} />
        <Route path="/playoff-watch" element={<PlayoffWatch />} />
        <Route path="/team/:teamId" element={<TeamDetail />} />
        <Route path="/conferences" element={<Conferences />} />
        <Route path="/conference/:confSlug" element={<ConferenceDetail />} />
      </Route>
    </Routes>
  );
}
