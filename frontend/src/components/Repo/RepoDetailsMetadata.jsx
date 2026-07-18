import { Box, Typography, Tooltip, Divider } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { DateTime } from "luxon";
import { Markdown } from "utilities/MarkdowntoJsxWrapper";
import React from "react";
import transform from "../../utilities/transform";

const useStyles = makeStyles(() => ({
  sidebar: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '1.25rem',
    border: '1px solid #e5e7eb',
  },
  section: {
    marginBottom: '1.25rem',
  },
  label: {
    color: '#6b7280',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.375rem',
  },
  value: {
    color: '#0F2139',
    fontSize: '0.9rem',
    fontWeight: 500,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  divider: {
    margin: '1rem 0',
    borderColor: '#f3f4f6',
  },
}));

function RepoDetailsMetadata(props) {
  const classes = useStyles();
  const { repoURL, totalDownloads, lastUpdated, size, license, description } = props;
  const lastDate = lastUpdated
    ? DateTime.fromISO(lastUpdated).toRelative({ unit: ['weeks','days','hours','minutes'] })
    : null;

  const sections = [];

  if (description) {
    sections.push(
      <div key="desc" className={classes.section}>
        <Typography className={classes.label}>描述</Typography>
        <Typography className={classes.value}>
          <Markdown>{description}</Markdown>
        </Typography>
      </div>
    );
  }

  if (repoURL) {
    sections.push(
      <div key="repo" className={classes.section}>
        <Typography className={classes.label}>仓库</Typography>
        <Typography className={classes.value}>{repoURL}</Typography>
      </div>
    );
  }

  if (!isNaN(totalDownloads) && totalDownloads >= 0) {
    sections.push(
      <div key="downloads" className={classes.section}>
        <Typography className={classes.label}>下载量</Typography>
        <Typography className={classes.value}>{totalDownloads.toLocaleString()}</Typography>
      </div>
    );
  }

  if (lastDate) {
    sections.push(
      <div key="updated" className={classes.section}>
        <Typography className={classes.label}>最近推送</Typography>
        <Tooltip title={lastUpdated?.slice(0, 16) || ' '} placement="top">
          <Typography className={classes.value}>{lastDate}</Typography>
        </Tooltip>
      </div>
    );
  }

  if (size) {
    sections.push(
      <div key="size" className={classes.section}>
        <Typography className={classes.label}>总大小</Typography>
        <Typography className={classes.value}>{transform.formatBytes(size)}</Typography>
      </div>
    );
  }

  if (license) {
    sections.push(
      <div key="license" className={classes.section}>
        <Typography className={classes.label}>许可证</Typography>
        <Typography className={classes.value}><Markdown>{license}</Markdown></Typography>
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
export default RepoDetailsMetadata;
