import { Typography, Card, CardActionArea } from '@mui/material';
import { makeStyles } from '@mui/styles';
import { api, endpoints } from 'api';
import { host } from '../../host';
import React, { useEffect, useMemo, useState } from 'react';
import Loading from '../Shared/Loading';
import { useNavigate, createSearchParams } from 'react-router';
import { sortByCriteria } from 'utilities/sortCriteria';
import StarIcon from '@mui/icons-material/Star';
import UpdateIcon from '@mui/icons-material/Update';
import TrendingIcon from '@mui/icons-material/TrendingUp';
import DownloadIcon from '@mui/icons-material/Download';
import RepositoryIcon from '../Shared/RepositoryIcon';
import { DateTime } from 'luxon';

const useStyles = makeStyles((theme) => ({
  heroSection: {
    background: 'linear-gradient(180deg, #f3f8ff 0%, #ffffff 100%)',
    padding: '3.25rem 1.5rem 3.5rem',
    textAlign: 'center',
    borderBottom: '1px solid #e5e7eb',
  },
  heroContent: {
    maxWidth: '760px',
    margin: '0 auto',
  },
  heroTitle: {
    color: '#0F2139',
    fontWeight: 800,
    fontSize: '2.15rem',
    marginBottom: '0.45rem',
    letterSpacing: 0,
    lineHeight: 1.18,
  },
  heroSubtitle: {
    color: '#64748b',
    fontSize: '1rem',
    fontWeight: 400,
    margin: '0 auto',
  },
  section: {
    padding: '2rem 0',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid #f3f4f6',
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: '1.375rem',
    color: '#0F2139',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  viewAll: {
    color: '#2563eb',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    '&:hover': { textDecoration: 'underline' },
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  },
  card: {
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
    '&:hover': {
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      transform: 'translateY(-1px)',
      borderColor: '#2563eb',
    },
  },
  cardAction: {
    padding: '1.25rem',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    width: '100%',
  },
  cardIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: '#f0f7ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#2563eb',
    flexShrink: 0,
    overflow: 'hidden',
    '& svg': { fontSize: '1.5rem' },
    '& img': { width: '100%', height: '100%', objectFit: 'cover' },
  },
  cardName: {
    fontWeight: 600,
    fontSize: '1rem',
    color: '#0F2139',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  cardDesc: {
    color: '#6b7280',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    marginBottom: '0.75rem',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textAlign: 'left',
    width: '100%',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '0.75rem',
    color: '#9ca3af',
    flexWrap: 'wrap',
  },
  cardMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  cardBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginTop: '0.625rem',
    flexWrap: 'wrap',
  },
  badge: {
    fontSize: '0.6875rem',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: '#f0f7ff',
    color: '#2563eb',
    fontWeight: 500,
    border: '1px solid #dbeafe',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1.5rem',
  },
}));

const getTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  try { return DateTime.fromISO(dateStr).toRelative({ unit: ['weeks', 'days', 'hours', 'minutes'] }); }
  catch { return ''; }
};

function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [popularData, setPopularData] = useState([]);
  const [recentData, setRecentData] = useState([]);

  const navigate = useNavigate();
  const abortController = useMemo(() => new AbortController(), []);
  const classes = useStyles();

  const fetchData = (sortBy, pageSize, setter, filter = {}) => {
    const url = host() + endpoints.globalSearch({
      searchQuery: '',
      pageNumber: 1,
      pageSize,
      sortBy,
      filter,
    });
    api.get(url, abortController.signal)
      .then((response) => {
        const repos = response.data?.data?.GlobalSearch?.Repos || [];
        const mapped = repos.map((r) => ({
          name: r.Name || r.RepoName || '',
          description: r.NewestImage?.Description || r.Description || '',
          downloads: r.DownloadCount || r.Downloads || 0,
          stars: r.StarCount || r.Stars || 0,
          platforms: r.Platforms || [],
          lastUpdated: r.LastUpdated || '',
          logo: '',
        }));
        setter(mapped);
      })
      .catch(() => setter([]));
  };

  useEffect(() => {
    setIsLoading(true);
    fetchData(sortByCriteria.downloads?.value, 8, setPopularData);
    fetchData(sortByCriteria.updateTime?.value, 4, setRecentData);
    setIsLoading(false);
    return () => abortController.abort();
  }, []);

  const handleViewAll = (type, value) => {
    navigate({ pathname: '/explore', search: createSearchParams({ [type]: value }).toString() });
  };

  const renderCard = (item, index) => {
    return (
      <Card key={index} className={classes.card} variant="outlined">
        <CardActionArea onClick={() => navigate(`/image/${item.name}`)} className={classes.cardAction}>
          <div className={classes.cardTop}>
            <div className={classes.cardIcon}>
              {item.logo ? <img src={item.logo} alt="" /> : <RepositoryIcon />}
            </div>
            <div className={classes.cardName}>{item.name}</div>
          </div>
          <div className={classes.cardDesc}>
            {item.description || '暂无描述'}
          </div>
          <div className={classes.cardMeta}>
            {!isNaN(item.downloads) && item.downloads > 0 && (
              <span className={classes.cardMetaItem}>
                <DownloadIcon sx={{ fontSize: 14 }} /> {item.downloads.toLocaleString()}
              </span>
            )}
            {!isNaN(item.stars) && item.stars > 0 && (
              <span className={classes.cardMetaItem}>
                <StarIcon sx={{ fontSize: 14 }} /> {item.stars}
              </span>
            )}
            {item.lastUpdated && (
              <span className={classes.cardMetaItem}>
                <UpdateIcon sx={{ fontSize: 14 }} /> {getTimeAgo(item.lastUpdated)}
              </span>
            )}
          </div>
          <div className={classes.cardBadges}>
            {(item.platforms || []).slice(0, 3).map((p, i) => {
              const os = p.Os || p.os || '';
              const arch = p.Arch || p.architecture || '';
              const label = os && arch ? `${os}/${arch}` : os || arch;
              return label ? <span key={i} className={classes.badge}>{label}</span> : null;
            })}
            {(item.platforms || []).length > 3 && (
              <span className={classes.badge}>+{item.platforms.length - 3}</span>
            )}
          </div>
        </CardActionArea>
      </Card>
    );
  };

  const renderSection = (title, icon, data, sortValue) => {
    if (!data || data.length === 0) return null;
    return (
      <div className={classes.section}>
        <div className={classes.sectionHeader}>
          <Typography className={classes.sectionTitle}>
            {icon} {title}
          </Typography>
          <Typography className={classes.viewAll} onClick={() => handleViewAll('sortby', sortValue)}>
            查看全部 →
          </Typography>
        </div>
        <div className={classes.cardGrid}>
          {data.map((item, i) => renderCard(item, i))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Hero 搜索区域 */}
      <div className={classes.heroSection}>
        <div className={classes.heroContent}>
          <Typography className={classes.heroTitle}>
            探索容器镜像
          </Typography>
          <Typography className={classes.heroSubtitle}>
            搜索和发现私有仓库中的镜像
          </Typography>
        </div>
      </div>

      {/* 内容区 */}
      <div className={classes.container}>
        {isLoading ? (
          <Loading />
        ) : (
          <>
            {renderSection('最多下载', <TrendingIcon sx={{ color: '#2563eb' }} />, popularData, sortByCriteria.downloads?.value)}
            {renderSection('最近更新', <UpdateIcon sx={{ color: '#059669' }} />, recentData, sortByCriteria.updateTime?.value)}
          </>
        )}
      </div>
    </div>
  );
}

export default Home;
