import { Typography, Tooltip, Divider } from '@mui/material';
import makeStyles from '@mui/styles/makeStyles';
import { DateTime } from 'luxon';
import React from 'react';
import transform from '../../utilities/transform';

const useStyles = makeStyles(() => ({
  sidebar: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '0.35rem 1.25rem',
    border: '1px solid #dfe5ee',
    minHeight: '438px',
  },
  section: {
    minHeight: '78px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  label: {
    color: '#667085',
    fontSize: '0.75rem',
    fontWeight: 700,
    marginBottom: '0.45rem',
  },
  value: {
    color: '#122033',
    fontSize: '0.9rem',
    fontWeight: 700,
    wordBreak: 'break-word',
  },
  divider: { borderColor: '#edf0f5' },
}));

function TagDetailsMetadata(props) {
  const classes = useStyles();
  const { platform, size, lastUpdated, lastTagged, license, imageName } = props;
  const lastDate = lastUpdated ? DateTime.fromISO(lastUpdated).toRelative({ unit: ['weeks','days','hours','minutes'] }) : null;
  const taggedDate = lastTagged ? DateTime.fromISO(lastTagged).toRelative({ unit: ['weeks','days','hours','minutes'] }) : null;

  const sections = [];

  if (imageName) {
    sections.push(
      <div key="image" className={classes.section}>
        <Typography className={classes.label}>镜像</Typography>
        <Typography className={classes.value}>{imageName}</Typography>
      </div>
    );
  }

  if (platform && platform !== '----/----') {
    sections.push(
      <div key="platform" className={classes.section}>
        <Typography className={classes.label}>平台</Typography>
        <Typography className={classes.value}>{platform}</Typography>
      </div>
    );
  }

  if (size) {
    sections.push(
      <div key="size" className={classes.section}>
        <Typography className={classes.label}>大小</Typography>
        <Typography className={classes.value}>{transform.formatBytes(size)}</Typography>
      </div>
    );
  }

  if (lastDate) {
    sections.push(
      <div key="updated" className={classes.section}>
        <Typography className={classes.label}>最近推送</Typography>
        <Tooltip title={lastUpdated?.slice(0,16) || ' '} placement="top">
          <Typography className={classes.value}>{lastDate}</Typography>
        </Tooltip>
      </div>
    );
  }

  if (taggedDate) {
    sections.push(
      <div key="tagged" className={classes.section}>
        <Typography className={classes.label}>最近标记</Typography>
        <Typography className={classes.value}>{taggedDate}</Typography>
      </div>
    );
  }

  if (license) {
    sections.push(
      <div key="license" className={classes.section}>
        <Typography className={classes.label}>许可证</Typography>
        <Typography className={classes.value}>{license}</Typography>
      </div>
    );
  }

  if (sections.length === 0) return null;

  return (
    <div className={classes.sidebar}>
      {sections.map((section, index) => (
        <React.Fragment key={section.key}>
          {index > 0 && <Divider className={classes.divider} />}
          {section}
        </React.Fragment>
      ))}
    </div>
  );
}
export default TagDetailsMetadata;
