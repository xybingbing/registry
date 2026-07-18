import React, { useEffect, useMemo, useState } from 'react';

// components
import { Typography } from '@mui/material';
import LayerCard from '../../Shared/LayerCard.jsx';
import makeStyles from '@mui/styles/makeStyles';
import Loading from '../../Shared/Loading';

const useStyles = makeStyles(() => ({
  layerPanel: {
    border: '1px solid #dfe5ee',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  layerHeader: {
    minHeight: '43px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 1.1rem',
    backgroundColor: '#f4f4f6',
  },
  layerName: {
    color: '#111827',
    fontSize: '0.98rem',
    fontWeight: 700,
  },
  none: {
    color: '#52637A',
    fontSize: '1.05rem',
    fontWeight: '600',
    padding: '2rem',
    textAlign: 'center',
  }
}));

function HistoryLayers(props) {
  const classes = useStyles();
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const abortController = useMemo(() => new AbortController(), []);
  const { name, tag, history } = props;

  useEffect(() => {
    setHistoryData(history);
    setIsLoading(false);
    return () => {
      abortController.abort();
    };
  }, [name, history]);

  return (
    <>
      {isLoading ? (
        <Loading />
      ) : (
        <div className={classes.layerPanel} data-testid="layer-card-container">
          <div className={classes.layerHeader}>
            <Typography className={classes.layerName}>{name}:{tag}</Typography>
          </div>
          {historyData?.length > 0 ? (
            historyData.map((layer, index) => {
              return (
                <LayerCard
                  key={`${layer?.Layer?.Size}${index}`}
                  index={index + 1}
                  layer={layer?.Layer}
                  historyDescription={layer?.HistoryDescription}
                />
              );
            })
          ) : (
            <Typography className={classes.none}>暂无层数据</Typography>
          )}
        </div>
      )}
    </>
  );
}

export default HistoryLayers;
