import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import { SocketProvider } from "./context/SocketContext";
import Profile from "./pages/Profile";
// ✅ Protected Route
function PrivateRoute({ children }) {
  const token = localStorage.getItem("access");
  return token ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <SocketProvider>
      <Router>
        <Routes>

          {/* Public */}
          <Route
  path="/login"
  element={
    localStorage.getItem("access")
      ? <Navigate to="/chat" />
      : <Login />
  }
/>
          <Route path="/register" element={<Register />} />

          {/* Protected */}
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            }
          />

          {/* Redirect if already logged in */}
          <Route
            path="/login"
            element={
              localStorage.getItem("access")
                ? <Navigate to="/chat" />
                : <Login />
            }
          />
          <Route path="/profile" element={<Profile />} />

          {/* Default */}
          <Route path="*" element={<Navigate to="/login" />} />

        </Routes>
      </Router>
    </SocketProvider>
  );
}

export default App;