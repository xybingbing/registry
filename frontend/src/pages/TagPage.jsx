import React from 'react';
import Header from 'components/Header/Header';
import TagDetails from 'components/Tag/TagDetails';

function TagPage() {
  return (
    <div data-testid="tag-container">
      <Header />
      <TagDetails />
    </div>
  );
}
export default TagPage;
