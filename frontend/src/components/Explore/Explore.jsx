import React, { useEffect, useMemo, useRef, useState } from 'react';
import Loading from '../Shared/Loading';
import { Typography, FormControl, InputLabel, MenuItem, Select, Stack, Card, CardActionArea } from '@mui/material';
import { makeStyles } from '@mui/styles';
import { api, endpoints } from '../../api';
import { host } from '../../host';
import { mapToRepo } from 'utilities/objectModels.js';
import { useSearchParams, useNavigate } from 'react-router';
import { isNil } from 'lodash';
import { sortByCriteria } from 'utilities/sortCriteria.js';
import { EXPLORE_PAGE_SIZE } from 'utilities/paginationConstants.js';
import SearchIcon from '@mui/icons-material/Search';
import RepositoryIcon from '../Shared/RepositoryIcon';
import { DateTime } from 'luxon';

const useStyles = makeStyles((theme) => ({
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1rem 1.5rem 2rem',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  resultsCount: {
    color: '#6b7280',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  sortForm: {
    minWidth: '160px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
    },
  },
  contentRow: {
    display: 'block',
  },
  mainContent: {
    width: '100%',
    minWidth: 0,
  },
  cardGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  card: {
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    '&:hover': {
      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
      borderColor: '#2563eb',
    },
  },
  cardAction: {
    padding: '1.25rem 1.5rem',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 140px',
    alignItems: 'start',
    gap: '1rem',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.65rem',
    width: '100%',
  },
  cardIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '7px',
    backgroundColor: '#eef6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#2563eb',
    flexShrink: 0,
    overflow: 'hidden',
    '& svg': { fontSize: '1.15rem' },
    '& img': { width: '100%', height: '100%', objectFit: 'cover' },
  },
  cardName: {
    fontWeight: 700,
    fontSize: '1.35rem',
    color: '#0F2139',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  cardDesc: {
    color: '#52637a',
    fontSize: '1rem',
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
    gap: '0.45rem',
    fontSize: '0.75rem',
    color: '#52637a',
    flexWrap: 'wrap',
  },
  cardBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginTop: '1rem',
    marginBottom: '0.5rem',
    flexWrap: 'wrap',
  },
  cardMain: {
    minWidth: 0,
  },
  cardStats: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    color: '#52637a',
    fontSize: '0.8rem',
    paddingTop: '0.2rem',
    whiteSpace: 'nowrap',
  },
  statStrong: {
    color: '#111827',
    fontWeight: 700,
  },
  badge: {
    minHeight: '22px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.6875rem',
    lineHeight: 1,
    padding: '0 8px',
    borderRadius: '6px',
    backgroundColor: '#f0f7ff',
    color: '#2563eb',
    fontWeight: 500,
    border: '1px solid #dbeafe',
  },
  emptyState: {
    textAlign: 'center',
    padding: '2rem 1rem',
    color: '#6b7280',
  },
}));

const getTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  try { return DateTime.fromISO(dateStr).toRelative({ unit: ['weeks', 'days', 'hours', 'minutes'] }); }
  catch { return ''; }
};

function Explore() {
  const [isLoading, setIsLoading] = useState(true);
  const [exploreData, setExploreData] = useState([]);
  const [sortFilter, setSortFilter] = useState(sortByCriteria.relevance.value);
  const [queryParams] = useSearchParams();
  const search = queryParams.get('search');
  const [pageNumber, setPageNumber] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isEndOfList, setIsEndOfList] = useState(false);
  const listBottom = useRef(null);
  const abortController = useMemo(() => new AbortController(), []);
  const classes = useStyles();
  const navigate = useNavigate();

  const hasSearch = !isNil(search) && search !== '';

  const getPaginatedResults = () => {
    setIsLoading(true);
    api
      .get(
        `${host()}${endpoints.globalSearch({
          searchQuery: hasSearch ? search : '',
          pageNumber,
          pageSize: EXPLORE_PAGE_SIZE,
          sortBy: sortFilter,
          filter: {}
        })}`,
        abortController.signal
      )
      .then((response) => {
        if (response.data && response.data.data) {
          let repoList = response.data.data.GlobalSearch.Repos || [];
          let repoData = repoList.map((responseRepo) => {
            return mapToRepo(responseRepo);
          });
          setTotalItems(response.data.data.GlobalSearch.Page?.TotalCount || 0);
          setIsEndOfList((repoData.length || 0) < EXPLORE_PAGE_SIZE);
          setExploreData((previousState) => [...previousState, ...repoData]);
        }
        setIsLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setIsLoading(false);
        setIsEndOfList(true);
      });
  };

  const resetPagination = async () => {
    setIsEndOfList(false);
    setExploreData([]);
    if (pageNumber !== 1) {
      setPageNumber(1);
    } else {
      getPaginatedResults();
    }
  };

  useEffect(() => {
    if (isLoading) return;
    setExploreData([]);
    resetPagination();
  }, [search, sortFilter]);

  useEffect(() => {
    getPaginatedResults();
    return () => {
      abortController.abort();
    };
  }, [pageNumber]);

  useEffect(() => {
    if (isLoading || isEndOfList || exploreData.length === 0) return;
    const handleIntersection = (entries) => {
      if (isLoading || isEndOfList) return;
      const [target] = entries;
      if (target?.isIntersecting) {
        setPageNumber((pageNumber) => pageNumber + 1);
      }
    };
    const intersectionObserver = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '0px',
      threshold: 0
    });
    if (listBottom.current) {
      intersectionObserver.observe(listBottom.current);
    }
    return () => {
      intersectionObserver.disconnect();
    };
  }, [isLoading, isEndOfList, exploreData.length]);

  const handleSortChange = (event) => {
    setSortFilter(event.target.value);
  };

  const renderCardGrid = () => {
    return (
      <div className={classes.cardGrid}>
        {exploreData.map((item, index) => {
          return (
            <Card key={index} className={classes.card} variant="outlined">
              <CardActionArea
                    onClick={() => navigate(`/image/${item.name}`)}
                className={classes.cardAction}
              >
                <div className={classes.cardMain}>
                  <div className={classes.cardTop}>
                    <div className={classes.cardIcon}>{item.logo ? <img src={item.logo} alt="" /> : <RepositoryIcon />}</div>
                    <div className={classes.cardName}>{item.name}</div>
                  </div>
                  <div className={classes.cardDesc}>
                    {item.description || 'Description not available'}
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
                  <div className={classes.cardMeta}>
                    <span>Vendor not available</span>
                    {item.lastUpdated && <span>· pushed {getTimeAgo(item.lastUpdated)}</span>}
                  </div>
                </div>
                <div className={classes.cardStats}>
                  <span>Downloads · <span className={classes.statStrong}>{!isNaN(item.downloads) ? Number(item.downloads).toLocaleString() : 0}</span></span>
                </div>
              </CardActionArea>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div className={classes.container}>
        <div className={classes.toolbar}>
          <Typography className={classes.resultsCount}>
            {hasSearch
              ? (totalItems > 0 ? `共 ${totalItems} 条结果，显示 ${exploreData.length} 条，搜索 "${search}"` : `搜索 "${search}" 的结果`)
              : `共 ${totalItems} 条结果，显示 ${exploreData.length} 条`}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" className={classes.sortForm}>
              <InputLabel>排序</InputLabel>
              <Select
                label="排序"
                value={sortFilter}
                onChange={handleSortChange}
                MenuProps={{ disableScrollLock: true }}
              >
                {Object.values(sortByCriteria).map((el) => (
                  <MenuItem key={el.value} value={el.value}>{el.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </div>

        <div className={classes.contentRow}>
          <div className={classes.mainContent}>
            {isLoading && exploreData.length === 0 ? (
              <Loading />
            ) : exploreData.length === 0 ? (
              <div className={classes.emptyState}>
                <SearchIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
                <Typography variant="h6" sx={{ color: '#6b7280', fontWeight: 600 }}>
                  未找到结果
                </Typography>
                <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                  尝试调整搜索条件或筛选器
                </Typography>
              </div>
            ) : (
              <>
                {renderCardGrid()}
                <div ref={listBottom} />
                {isLoading && <Loading />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Explore;
