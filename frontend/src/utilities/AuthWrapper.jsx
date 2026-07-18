import React from 'react';
import { Navigate, Outlet } from 'react-router';
import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles(() => ({
  topMargin: {
    minHeight: '100vh',
    height: '100%'
  }
}));

const AuthWrapper = ({ isLoggedIn, redirect, hasHeader = false }) => {
  const classes = useStyles();

  return isLoggedIn ? (
    <div className={hasHeader ? classes.topMargin : null}>
      <Outlet />
    </div>
  ) : (
    <Navigate to={redirect} replace={true} />
  );
};

export { AuthWrapper };
