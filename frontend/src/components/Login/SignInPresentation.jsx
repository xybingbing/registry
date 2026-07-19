import React from 'react';

import { Stack, Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles(() => ({
  container: {
    backgroundColor: '#18324B',
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    boxSizing: 'border-box'
  },
  contentContainer: {
    width: '100%',
    maxWidth: '27rem'
  },
  mainText: {
    color: '#F6F7F9',
    fontWeight: '700',
    width: '100%',
    fontSize: '2.25rem',
    lineHeight: '3rem',
    letterSpacing: 0
  }
}));

export default function SigninPresentation() {
  const classes = useStyles();
  return (
    <div className={classes.container}>
      <Stack spacing={'2rem'} className={classes.contentContainer} data-testid="presentation-container">
        <Typography variant="h2" className={classes.mainText}>
          Docker / OCI 原生容器镜像仓库
        </Typography>
      </Stack>
    </div>
  );
}
