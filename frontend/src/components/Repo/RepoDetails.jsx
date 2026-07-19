import React, { useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { api, endpoints } from '../../api';
import { host } from '../../host';
import { useParams, useNavigate } from 'react-router';
import { mapToRepoFromRepoInfo } from 'utilities/objectModels';
import { isAuthenticated } from 'utilities/authUtilities';
import { Grid, Typography, IconButton, Tooltip } from '@mui/material';
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DownloadIcon from "@mui/icons-material/Download";
import UpdateIcon from "@mui/icons-material/Update";
import LinkIcon from "@mui/icons-material/Link";
import StorageIcon from "@mui/icons-material/Storage";
import RepositoryIcon from "../Shared/RepositoryIcon";
import Tags from './Tabs/Tags.jsx';
import Loading from '../Shared/Loading';
import makeStyles from '@mui/styles/makeStyles';
import transform from '../../utilities/transform';

const useStyles = makeStyles(() => ({
  container: { maxWidth: '1200px', margin: '0 auto', padding: '1.75rem 1.5rem 2rem' },
  headerCard: {
    borderBottom: '1px solid #e5e7eb',
    padding: '0.75rem 0 1.5rem',
    marginBottom: '2rem',
  },
  headerTop: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    alignItems: 'start',
    gap: '1rem',
  },
  icon: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    backgroundColor: '#f0f7ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#2563eb',
    flexShrink: 0,
    border: '1px solid #dbeafe',
    '& svg': {
      fontSize: '1.8rem',
    },
  },
  titleBlock: {
    minWidth: 0,
    textAlign: 'left',
  },
  repoName: {
    fontWeight: 700,
    fontSize: '1.75rem',
    color: '#0F2139',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    overflowWrap: 'anywhere',
  },
  repoDescription: {
    color: '#6b7280',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    marginTop: '0.35rem',
    maxWidth: '760px',
  },
  sourceLink: {
    alignItems: 'center',
    color: '#2563eb',
    display: 'inline-flex',
    fontSize: '0.82rem',
    gap: '0.3rem',
    marginTop: '0.35rem',
    maxWidth: '100%',
    textDecoration: 'none',
    '& span': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  actionGroup: {
    display: 'flex',
    gap: '0.35rem',
  },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    marginTop: '1rem',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.875rem',
    color: '#6b7280'
  },
  metaStrong: {
    color: '#0F2139',
    fontWeight: 600,
  },
  badge: { fontSize: '0.6875rem', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#f0f7ff', color: '#2563eb', fontWeight: 500, border: '1px solid #dbeafe' },
  tagSection: { marginTop: '1.5rem' },
}));

function RepoDetails() {
  const [repoDetailData, setRepoDetailData] = useState({});
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const navigate = useNavigate();
  const repoName = params['*'] || (params.namespace && params.repo ? `${params.namespace}/${params.repo}` : params.name);
  const abortController = useMemo(() => new AbortController(), []);
  const classes = useStyles();

  useEffect(() => {
    setIsLoading(true);
    api.get(host() + endpoints.detailedRepoInfo(repoName), abortController.signal)
      .then((response) => {
        if (response.data?.data?.ExpandedRepoInfo) {
          let imageData = mapToRepoFromRepoInfo(response.data.data.ExpandedRepoInfo);
          setRepoDetailData(imageData);
          setTags(imageData.images || []);
        }
        setIsLoading(false);
      })
      .catch((e) => { console.error(e); setIsLoading(false); });
    return () => abortController.abort();
  }, [repoName]);

  const handleStarClick = () => {
    api.put(host() + endpoints.starToggle(repoName), abortController.signal).then((r) => {
      if (r.status === 200) setRepoDetailData((p) => ({ ...p, isStarred: !p.isStarred }));
    });
  };
  const handleBookmarkClick = () => {
    api.put(host() + endpoints.bookmarkToggle(repoName), abortController.signal).then((r) => {
      if (r.status === 200) setRepoDetailData((p) => ({ ...p, isBookmarked: !p.isBookmarked }));
    });
  };
  const handleDeleteTag = (tag) => {
    api.delete(host() + endpoints.deleteImage(repoName, tag), {}, abortController.signal).then((r) => {
      if (r.status === 202) navigate(0);
    });
  };
  const getLast = () => repoDetailData.lastUpdated
    ? DateTime.fromISO(repoDetailData.lastUpdated).toRelative({ unit: ['weeks','days','hours','minutes'] }) : '暂无';

  if (isLoading) return <Loading />;

  const platforms = repoDetailData.platforms || [];
  const repoURL = repoDetailData.source;
  const canManageRepo = isAuthenticated();

  return (
    <div className={classes.container}>
      <div className={classes.headerCard}>
        <div className={classes.headerTop}>
          <div className={classes.icon}>
            <RepositoryIcon />
          </div>
          <div className={classes.titleBlock}>
            <Typography className={classes.repoName}>{repoName}</Typography>
            {repoDetailData.description && (
              <Typography className={classes.repoDescription}>{repoDetailData.description}</Typography>
            )}
            {repoURL && (
              <a className={classes.sourceLink} href={repoURL} target="_blank" rel="noreferrer">
                <LinkIcon sx={{ fontSize: 15 }} />
                <span>{repoURL}</span>
              </a>
            )}
          </div>
          {canManageRepo && (
            <div className={classes.actionGroup}>
              <Tooltip title={repoDetailData.isStarred ? '取消星标' : '添加星标'} placement="top">
                <IconButton onClick={handleStarClick} data-testid="star-button">
                  {repoDetailData.isStarred ? <StarIcon sx={{ color: '#d97706' }} /> : <StarBorderIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title={repoDetailData.isBookmarked ? '取消收藏' : '添加收藏'} placement="top">
                <IconButton onClick={handleBookmarkClick} data-testid="bookmark-button">
                  {repoDetailData.isBookmarked ? <BookmarkIcon sx={{ color: '#2563eb' }} /> : <BookmarkBorderIcon />}
                </IconButton>
              </Tooltip>
            </div>
          )}
        </div>
        <div className={classes.headerMeta}>
          <span className={classes.metaItem}><DownloadIcon sx={{ fontSize: 16 }} /> 下载 <span className={classes.metaStrong}>{!isNaN(repoDetailData.downloads) ? repoDetailData.downloads : '暂无'}</span></span>
          <span className={classes.metaItem}><StarIcon sx={{ fontSize: 16, color: '#d97706' }} /> 星标 <span className={classes.metaStrong}>{!isNaN(repoDetailData.stars) ? repoDetailData.stars : '0'}</span></span>
          <span className={classes.metaItem}><UpdateIcon sx={{ fontSize: 16 }} /> 最近推送 <span className={classes.metaStrong}>{getLast()}</span></span>
          {repoDetailData.size && (
            <span className={classes.metaItem}><StorageIcon sx={{ fontSize: 16 }} /> 总大小 <span className={classes.metaStrong}>{transform.formatBytes(repoDetailData.size)}</span></span>
          )}
          {platforms.slice(0, 5).map((p, i) => {
            const os = p.Os || p.os || '';
            const arch = p.Arch || p.architecture || '';
            const label = os && arch ? os+'/'+arch : os || arch;
            return label ? <span key={i} className={classes.badge}>{label}</span> : null;
          })}
          {platforms.length > 5 && <span className={classes.badge}>+{platforms.length - 5}</span>}
        </div>
      </div>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Tags tags={tags} repoName={repoName} onTagDelete={canManageRepo ? handleDeleteTag : undefined} />
        </Grid>
      </Grid>
    </div>
  );
}
export default RepoDetails;
