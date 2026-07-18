// react global
import { Link, useLocation, useNavigate } from 'react-router';

// components
import { Typography, Breadcrumbs } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// styling

import makeStyles from '@mui/styles/makeStyles';
import React from 'react';

const useStyles = makeStyles((theme) => {
  return {
    exploreHeader: {
      backgroundColor: 'transparent',
      minHeight: 40,
      padding: '1rem 0 0.5rem 0',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      [theme.breakpoints.down('md')]: {
        padding: '0.75rem'
      }
    },
    explore: {
      color: '#6b7280',
      fontSize: '0.813rem',
      fontWeight: '500',
      letterSpacing: '0.009375rem',
      [theme.breakpoints.down('md')]: {
        fontSize: '0.8rem'
      }
    },
    arrowIcon: {
      color: '#6b7280',
      marginRight: '1rem',
      fontSize: { xs: '1.5rem', md: '1.75rem' },
      cursor: 'pointer',
      '&:hover': {
        color: '#2563eb',
      }
    }
  };
});

function ExploreHeader() {
  const classes = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const pathWithoutImage = path.replace('tag/', '');
  const pathToBeDisplayed = pathWithoutImage.replace('/image/', '');
  const pathHeader = pathToBeDisplayed.replace('/', ' / ').replace(/%2F/g, '/');
  const pathWithTag = path.substring(0, path.lastIndexOf('/'));

  return (
    <div className={classes.exploreHeader}>
      <ArrowBackIcon className={classes.arrowIcon} onClick={() => navigate(-1)} />
      <Breadcrumbs separator="/" aria-label="breadcrumb">
        <Link to="/">
          <Typography variant="body1" className={classes.explore}>
            首页
          </Typography>
        </Link>
        <Link to={pathWithTag.substring(0, pathWithTag.lastIndexOf('/'))}>
          {path.includes('/image/') && (
            <Typography className={classes.explore} variant="body1">
              {pathHeader}
            </Typography>
          )}
        </Link>
      </Breadcrumbs>
    </div>
  );
}

export default ExploreHeader;
