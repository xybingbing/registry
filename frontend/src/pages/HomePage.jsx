import React from 'react';
import Header from '../components/Header/Header.jsx';
import Home from 'components/Home/Home.jsx';

function HomePage() {
  return (
    <div data-testid="homepage-container">
      <Header />
      <Home />
    </div>
  );
}

export default HomePage;
