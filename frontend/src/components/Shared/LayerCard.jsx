import React from 'react';

import transform from 'utilities/transform';

import { Typography } from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles(() => ({
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 120px',
    alignItems: 'center',
    minHeight: '51px',
    borderTop: '1px solid #e6e9ee',
    backgroundColor: '#ffffff',
  },
  command: {
    color: '#111827',
    fontSize: '0.9rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    paddingLeft: '1.1rem',
    paddingRight: '1.25rem',
    textAlign: 'left',
  },
  size: {
    color: '#111827',
    fontSize: '0.9rem',
    textAlign: 'right',
    paddingRight: '3.05rem',
    whiteSpace: 'nowrap',
  },
  '@media (max-width: 700px)': {
    row: {
      gridTemplateColumns: 'minmax(0, 1fr) 86px',
    },
    command: {
      paddingLeft: '0.75rem',
    },
    size: {
      paddingRight: '0.75rem',
    },
  },
}));

function LayerCard(props) {
  const classes = useStyles();
  const { layer, historyDescription } = props;

  const getLayerSize = () => {
    if (historyDescription?.EmptyLayer) return 0;
    return layer?.Size || 0;
  };

  return (
    <div className={classes.row}>
      <Typography className={classes.command} title={historyDescription?.CreatedBy || ''}>
        {historyDescription?.CreatedBy || '----'}
      </Typography>
      <Typography className={classes.size}>{transform.formatBytes(getLayerSize())}</Typography>
    </div>
  );
}

export default LayerCard;
