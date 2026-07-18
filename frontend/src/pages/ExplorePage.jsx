import React from 'react';
import Header from '../components/Header/Header.jsx';
import Explore from 'components/Explore/Explore.jsx';

function ExplorePage() {
  return (
    <div data-testid="explore-container">
      <Header />
      <Explore />
    </div>
  );
}

export default ExplorePage;
