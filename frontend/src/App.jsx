import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router';

import { isAuthenticated, isApiKeyEnabled } from 'utilities/authUtilities';
import { AuthWrapper } from 'utilities/AuthWrapper';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RepoPage from 'pages/RepoPage';
import TagPage from 'pages/TagPage';
import ExplorePage from 'pages/ExplorePage';
import UserManagementPage from 'pages/UserManagementPage';

import './App.css';

function ImageRoute() {
  const location = useLocation();
  const imagePath = location.pathname.replace(/^\/image\/?/, '');

  return imagePath.includes('/tag/') ? <TagPage /> : <RepoPage />;
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());

  return (
    <div className="App" data-testid="app-container">
      <Router>
        <Routes>
          <Route element={<AuthWrapper isLoggedIn hasHeader />}>
            <Route path="/" element={<Navigate to="/home" />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/image/*" element={<ImageRoute />} />
          </Route>
          <Route element={<AuthWrapper isLoggedIn={isLoggedIn} hasHeader redirect="/login" />}>
            {isApiKeyEnabled() && <Route path="/user/apikey" element={<UserManagementPage />} />}
          </Route>
          <Route element={<AuthWrapper isLoggedIn={!isLoggedIn} redirect="/home" />}>
            <Route path="/login" element={<LoginPage isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />} />
          </Route>
          <Route path="*" element={<Navigate to="/home" />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
