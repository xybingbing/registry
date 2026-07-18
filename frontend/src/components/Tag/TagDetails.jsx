import { Link, useLocation, useParams } from 'react-router';
import React, { useEffect, useMemo, useState } from 'react';
import { api, endpoints } from '../../api';
import { host } from '../../host';
import { mapToImage } from 'utilities/objectModels';
import { isEmpty, head } from 'lodash';
import { DateTime } from 'luxon';
import { Grid, Typography } from '@mui/material';
import HistoryLayers from './Tabs/HistoryLayers';
import Loading from '../Shared/Loading';
import makeStyles from '@mui/styles/makeStyles';
import transform from '../../utilities/transform';
import RepositoryIcon from '../Shared/RepositoryIcon';
import DeveloperBoardOutlinedIcon from '@mui/icons-material/DeveloperBoardOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import UpdateOutlinedIcon from '@mui/icons-material/UpdateOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';

const useStyles = makeStyles(() => ({
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0.75rem 1.5rem 2.5rem',
    color: '#0f1f33',
  },
  hero: {
    borderBottom: '1px solid #dfe5ee',
    padding: '0.35rem 0 1.45rem',
    marginBottom: '1.35rem',
  },
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    marginBottom: '1rem',
    color: '#667085',
    fontSize: '0.86rem',
  },
  breadcrumbLink: {
    color: '#2563eb',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  breadcrumbCurrent: {
    color: '#667085',
    fontWeight: 500,
  },
  breadcrumbSeparator: {
    color: '#94a3b8',
  },
  tagName: {
    margin: '0 0 0.65rem',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: '1.55rem',
    lineHeight: 1.25,
    color: '#122033',
    wordBreak: 'break-word',
  },
  digest: {
    color: '#667085',
    fontFamily: '"SF Mono", Monaco, Consolas, monospace',
    fontSize: '0.8rem',
    textAlign: 'left',
    wordBreak: 'break-all',
  },
  heroMeta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.85rem 1.55rem',
    marginTop: '0.95rem',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    minHeight: '24px',
  },
  metaIcon: {
    color: '#64748b',
    fontSize: '1rem',
  },
  metaLabel: {
    color: '#667085',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  metaValue: {
    color: '#122033',
    fontSize: '0.86rem',
    fontWeight: 700,
    wordBreak: 'break-word',
  },
  contentGrid: {
    alignItems: 'flex-start',
  },
  platformSelectorRow: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '2px solid #dfe5ee',
    marginBottom: '1.75rem',
    flexWrap: 'wrap',
    minHeight: '48px',
  },
  platformTab: {
    border: 'none',
    borderBottom: '3px solid transparent',
    borderRadius: 0,
    marginBottom: '-2px',
    minHeight: '48px',
    padding: '0.85rem 0.95rem',
    color: '#667085',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '0.86rem',
    fontWeight: 700,
    '&:hover': {
      color: '#2563eb',
      backgroundColor: '#f8fbff',
    },
  },
  platformTabActive: {
    color: '#2563eb',
    borderBottomColor: '#2563eb',
  },
  tabContent: { paddingTop: '0' },
  '@media (max-width: 900px)': {
    heroMeta: { gap: '0.6rem 1rem' },
  },
}));

function TagDetails() {
  const [imageDetailData, setImageDetailData] = useState({});
  const [selectedManifest, setSelectedManifest] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const abortController = useMemo(() => new AbortController(), []);
  const { state } = useLocation() || {};
  const { digest } = state || '';
  const params = useParams();
  const splat = params['*'] || '';
  const tagMarker = '/tag/';
  const tagIndex = splat.lastIndexOf(tagMarker);
  const tag = tagIndex >= 0 ? splat.slice(tagIndex + tagMarker.length) : params.tag;
  const reponame = tagIndex >= 0
    ? splat.slice(0, tagIndex)
    : params.namespace && params.repo
      ? `${params.namespace}/${params.repo}`
      : params.reponame;
  const classes = useStyles();

  useEffect(() => {
    window?.scrollTo(0, 0);
    setIsLoading(true);
    api.get(host() + endpoints.detailedImageInfo(reponame, tag), abortController.signal)
      .then((response) => {
        if (response.data?.data?.Image) {
          let imageData = mapToImage(response.data.data.Image);
          setImageDetailData(imageData);
          if (!isEmpty(digest)) {
            const pre = imageData.manifests?.find((el) => el.digest === digest);
            setSelectedManifest(pre || head(imageData.manifests));
          } else {
            setSelectedManifest(head(imageData.manifests));
          }
        }
        setIsLoading(false);
      })
      .catch((e) => { console.error(e); setIsLoading(false); });
    return () => abortController.abort();
  }, [reponame, tag]);

  const handlePlatformSelect = (manifest) => setSelectedManifest(manifest);
  const getPlatform = () => selectedManifest?.platform
    ? (selectedManifest.platform.Os || '----') + '/' + (selectedManifest.platform.Arch || '----')
    : '----/----';
  const getRelativeTime = (value) => value
    ? DateTime.fromISO(value).toRelative({ unit: ['weeks','days','hours','minutes'] })
    : '暂无';
  const getSize = () => selectedManifest?.size ? transform.formatBytes(selectedManifest.size) : '暂无';
  const repoParts = reponame.split('/');
  const repoDisplayName = repoParts[repoParts.length - 1] || reponame;
  const repoGroupName = repoParts[0];

  if (isLoading) return <Loading />;

  return (
    <div className={classes.container}>
      <div className={classes.hero}>
        <div className={classes.breadcrumbs}>
          <Link to="/explore" className={classes.breadcrumbLink}>Explore</Link>
          <span className={classes.breadcrumbSeparator}>/</span>
          <Link to={`/image/${reponame}`} className={classes.breadcrumbLink}>{repoGroupName}</Link>
          <span className={classes.breadcrumbSeparator}>/</span>
          <span className={classes.breadcrumbCurrent}>{repoDisplayName}</span>
        </div>
        <Typography className={classes.tagName}>{reponame}:{tag}</Typography>
        <Typography className={classes.digest}>摘要：{selectedManifest?.digest}</Typography>
        <div className={classes.heroMeta}>
          <div className={classes.metaItem}>
            <RepositoryIcon className={classes.metaIcon} />
            <Typography className={classes.metaLabel}>镜像</Typography>
            <Typography className={classes.metaValue}>{imageDetailData?.name || `${reponame}:${tag}`}</Typography>
          </div>
          <div className={classes.metaItem}>
            <DeveloperBoardOutlinedIcon className={classes.metaIcon} />
            <Typography className={classes.metaLabel}>平台</Typography>
            <Typography className={classes.metaValue}>{getPlatform()}</Typography>
          </div>
          <div className={classes.metaItem}>
            <StorageOutlinedIcon className={classes.metaIcon} />
            <Typography className={classes.metaLabel}>大小</Typography>
            <Typography className={classes.metaValue}>{getSize()}</Typography>
          </div>
          <div className={classes.metaItem}>
            <UpdateOutlinedIcon className={classes.metaIcon} />
            <Typography className={classes.metaLabel}>最近推送</Typography>
            <Typography className={classes.metaValue}>{getRelativeTime(selectedManifest?.lastUpdated)}</Typography>
          </div>
          <div className={classes.metaItem}>
            <LocalOfferOutlinedIcon className={classes.metaIcon} />
            <Typography className={classes.metaLabel}>最近标记</Typography>
            <Typography className={classes.metaValue}>{getRelativeTime(imageDetailData?.lastTagged)}</Typography>
          </div>
        </div>
      </div>

      <Grid container spacing={2} className={classes.contentGrid}>
        <Grid item xs={12}>
          {imageDetailData?.manifests && imageDetailData.manifests.length > 0 && (
            <div className={classes.platformSelectorRow}>
              {imageDetailData.manifests.map((el) => {
                const platformStr = (el.platform?.Os || '----') + '/' + (el.platform?.Arch || '----');
                const isActive =
                  selectedManifest?.digest === el.digest ||
                  (!selectedManifest?.digest && el === head(imageDetailData.manifests));
                return (
                  <button
                    key={el.digest}
                    type="button"
                    className={[classes.platformTab, isActive ? classes.platformTabActive : ''].join(' ')}
                    onClick={() => handlePlatformSelect(el)}
                  >
                    {platformStr}
                  </button>
                );
              })}
            </div>
          )}
          <div className={classes.tabContent}>
            <HistoryLayers name={reponame} tag={tag} history={selectedManifest?.history} />
          </div>
        </Grid>
      </Grid>
    </div>
  );
}

export default TagDetails;
