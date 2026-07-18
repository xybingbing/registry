import React, { useState } from 'react';
import { makeStyles } from '@mui/styles';
import { useNavigate } from 'react-router';
import { IconButton, Tooltip, Typography } from '@mui/material';
import { Markdown } from 'utilities/MarkdowntojsxWrapper';
import transform from 'utilities/transform';
import { DateTime } from 'luxon';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { hostRoot } from 'host';
import { dockerPull } from 'utilities/pullStrings';
import DeleteTag from './DeleteTag';

const useStyles = makeStyles(() => ({
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '3px',
    padding: '1.5rem 1.5rem 1.25rem',
    textAlign: 'left',
  },
  headerRow: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: '1.5rem',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
  },
  tagLabel: {
    color: '#52637A',
    fontSize: '0.8rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    marginBottom: '0.45rem',
  },
  tagName: {
    color: '#0969ff',
    cursor: 'pointer',
    display: 'inline-block',
    fontSize: '0.92rem',
    fontWeight: 600,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  meta: {
    color: '#111827',
    fontSize: '0.8rem',
    marginTop: '0.55rem',
  },
  vendorLink: {
    color: '#0969ff',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  pullArea: {
    alignItems: 'center',
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
    minWidth: 0,
  },
  pullCommandBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #eef0f3',
    borderRadius: '4px',
    color: '#374151',
    fontFamily: '"SF Mono", Monaco, Consolas, monospace',
    fontSize: '0.9rem',
    lineHeight: 1,
    maxWidth: '520px',
    overflow: 'hidden',
    padding: '0.8rem 0.9rem',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  copyBtn: {
    color: '#0969ff',
    padding: '0.25rem',
    '&:hover': {
      backgroundColor: '#eff6ff',
    },
    '& svg': {
      fontSize: '1.75rem',
    },
  },
  deleteBtn: {
    color: '#dc2626',
    padding: '0.25rem',
    '&:hover': {
      backgroundColor: '#fef2f2',
    },
    '& svg': {
      fontSize: '1.6rem',
    },
  },
  table: {
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    width: '100%',
  },
  tableHeadCell: {
    borderBottom: '1px solid #d9d9d9',
    color: '#111827',
    fontSize: '0.85rem',
    fontWeight: 700,
    padding: '0.85rem 1rem 1rem',
    textAlign: 'left',
  },
  tableHeadRight: {
    textAlign: 'right',
  },
  sizeHeader: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: '0.25rem',
    justifyContent: 'flex-end',
  },
  tableCell: {
    borderBottom: '1px solid #d9d9d9',
    color: '#111827',
    fontSize: '0.88rem',
    padding: '1.25rem 1rem',
    textAlign: 'left',
    verticalAlign: 'middle',
  },
  tableCellRight: {
    textAlign: 'right',
  },
  digest: {
    color: '#0969ff',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  digestPlain: {
    color: '#0969ff',
  },
  emptyRow: {
    color: '#6b7280',
    fontSize: '0.9rem',
    padding: '1.25rem 1rem',
  },
}));

export default function TagCard(props) {
  const { repoName, tag, lastUpdated, vendor, manifests, repo, onTagDelete } = props;
  const [copied, setCopied] = useState(false);
  const classes = useStyles();
  const lastDate = lastUpdated ? DateTime.fromISO(lastUpdated).toRelative({ unit: ['weeks','days','hours','minutes'] }) : '暂无';
  const navigate = useNavigate();
  const imageRepo = repoName || repo;
  const isHelmChart = imageRepo?.startsWith('helm/');
  const pullCommand = isHelmChart
    ? `helm pull oci://${hostRoot()}/${imageRepo} --version ${tag}`
    : dockerPull(`${imageRepo}:${tag}`);

  const goToTags = (digest = null) => {
    if (isHelmChart) return;
    if (repoName) navigate('/image/' + repoName + '/tag/' + tag, { state: { digest } });
    else navigate('tag/' + tag, { state: { digest } });
  };

  const handleCopyPull = () => {
    navigator.clipboard.writeText(pullCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatDigest = (digest) => {
    if (!digest) return '----';
    return digest.replace(/^sha256:/, '').slice(0, 12);
  };

  return (
    <div className={classes.card}>
      <div className={classes.headerRow}>
        <div>
          <Typography className={classes.tagLabel}>TAG</Typography>
          <span className={classes.tagName} onClick={() => goToTags()}>
            {tag}
          </span>
          <Typography className={classes.meta}>
            <Tooltip title={lastUpdated?.slice(0, 16) || ' '} placement="top">
              <span>Last pushed {lastDate}</span>
            </Tooltip>
            {vendor ? (
              <>
                {' '}by <span className={classes.vendorLink}><Markdown options={{ forceInline: true }}>{vendor}</Markdown></span>
              </>
            ) : null}
          </Typography>
        </div>

        <div className={classes.pullArea}>
          <div className={classes.pullCommandBox}>{pullCommand}</div>
          <Tooltip title={copied ? '已复制' : '复制拉取命令'} placement="top">
            <IconButton className={classes.copyBtn} onClick={handleCopyPull} size="small">
              <ContentCopyOutlinedIcon />
            </IconButton>
          </Tooltip>
          {onTagDelete && (
            <Tooltip title="删除标签" placement="top">
              <span>
                <DeleteTag repo={imageRepo} tag={tag} onTagDelete={onTagDelete} className={classes.deleteBtn} />
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      <table className={classes.table}>
        <thead>
          <tr>
            <th className={classes.tableHeadCell}>Digest</th>
            <th className={classes.tableHeadCell}>OS/ARCH</th>
            <th className={[classes.tableHeadCell, classes.tableHeadRight].join(' ')}>
              <span className={classes.sizeHeader}>
                Compressed size
                <Tooltip title="镜像清单的压缩大小" placement="top">
                  <InfoOutlinedIcon sx={{ fontSize: 15 }} />
                </Tooltip>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {manifests?.length > 0 ? (
            manifests.map((el) => (
              <tr key={el.digest}>
                <td className={classes.tableCell}>
                  <Tooltip title={el.digest || ''} placement="top">
                    <span
                      className={isHelmChart ? classes.digestPlain : classes.digest}
                      onClick={isHelmChart ? undefined : () => goToTags(el.digest)}
                    >
                      {formatDigest(el.digest)}
                    </span>
                  </Tooltip>
                </td>
                <td className={classes.tableCell}>{el.platform?.Os || '----'}/{el.platform?.Arch || '----'}</td>
                <td className={[classes.tableCell, classes.tableCellRight].join(' ')}>
                  {transform.formatBytes(el.size)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className={classes.emptyRow} colSpan={3}>暂无 manifest 数据</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
