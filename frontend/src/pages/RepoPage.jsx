import React from 'react';
import Header from 'components/Header/Header';
import RepoDetails from 'components/Repo/RepoDetails';

function RepoPage() {
  return (
    <div data-testid="repo-container">
      <Header />
      <RepoDetails />
    </div>
  );
}
export default RepoPage;
