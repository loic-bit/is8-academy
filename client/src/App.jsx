import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import Login from './routes/Login.jsx';
import Signup from './routes/Signup.jsx';
import Forgot from './routes/Forgot.jsx';
import Reset from './routes/Reset.jsx';
import Home from './routes/Home.jsx';
import Course from './routes/Course.jsx';
import Calculators from './routes/Calculators.jsx';
import Brrrr from './routes/Brrrr.jsx';
import GoalPlanner from './routes/GoalPlanner.jsx';
import FiftyDoors from './routes/FiftyDoors.jsx';
import Quiz from './routes/Quiz.jsx';
import Compare from './routes/Compare.jsx';
import PropertyAnalyzer from './routes/PropertyAnalyzer.jsx';
import Finder from './routes/Finder.jsx';
import GetHelp from './routes/GetHelp.jsx';
import Admin from './routes/Admin.jsx';
import Vault, { VaultAsset, KitPage } from './routes/Vault.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset" element={<Reset />} />

      <Route
        path="/"
        element={
          <Protected>
            <DashboardLayout />
          </Protected>
        }
      >
        <Route index element={<Home />} />
        <Route path="course" element={<Course />} />
        <Route path="vault" element={<Vault />} />
        <Route path="vault/kit/:slug" element={<KitPage />} />
        <Route path="vault/:slug" element={<VaultAsset />} />
        <Route path="calculators" element={<Calculators />} />
        <Route path="brrrr" element={<Brrrr />} />
        <Route path="plan" element={<GoalPlanner />} />
        <Route path="fifty-doors" element={<FiftyDoors />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="compare" element={<Compare />} />
        <Route path="analyzer" element={<PropertyAnalyzer />} />
        <Route path="finder" element={<Finder />} />
        <Route path="get-help" element={<GetHelp />} />
        <Route path="admin" element={<Admin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
