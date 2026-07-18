import React, { useState } from 'react';
import { Stack, InputBase, FormControl, Select, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { makeStyles } from '@mui/styles';
import TagCard from '../../Shared/TagCard';
import { tagsSortByCriteria } from 'utilities/sortCriteria';

const useStyles = makeStyles(() => ({
  search: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginBottom: '0.25rem',
  },
  searchInputBase: {
    flex: 1,
    paddingLeft: '0.75rem',
    height: 40,
  },
  searchIcon: { color: '#9ca3af', paddingRight: '0.75rem' },
  tableHeader: {
    display: 'flex',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '0.5rem',
    marginBottom: '0.25rem',
  },
  tableHeaderText: {
    fontSize: '0.7rem',
    color: '#9ca3af',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  toolbar: {
    marginBottom: '0.6rem',
  },
}));

export default function Tags(props) {
  const classes = useStyles();
  const { tags, repoName, onTagDelete } = props;
  const [tagsFilter, setTagsFilter] = useState('');
  const [sortFilter, setSortFilter] = useState(tagsSortByCriteria.updateTimeDesc.value);

  const renderTags = () => {
    const selectedSort = Object.values(tagsSortByCriteria).find((sc) => sc.value === sortFilter);
    const filteredTags = (tags || []).filter((t) => t.tag?.includes(tagsFilter));
    if (selectedSort) filteredTags.sort(selectedSort.func);
    return filteredTags.map((tag) => (
      <TagCard key={tag.tag} tag={tag.tag} lastUpdated={tag.lastUpdated} vendor={tag.vendor}
        manifests={tag.manifests} repo={repoName} onTagDelete={onTagDelete} isDeletable={tag.isDeletable} />
    ));
  };

  return (
    <Stack direction="column" spacing="0.5rem">
      <Stack direction="row" justifyContent="space-between" alignItems="center" className={classes.toolbar}>
        <div className={classes.search}>
          <InputBase placeholder="搜索标签..." classes={{ root: classes.searchInputBase }}
            value={tagsFilter} onChange={(e) => setTagsFilter(e.target.value)} />
          <SearchIcon className={classes.searchIcon} />
        </div>
        <FormControl sx={{ minWidth: 120 }} size="small">
          <Select value={sortFilter} onChange={(e) => setSortFilter(e.target.value)} MenuProps={{ disableScrollLock: true }}>
            {Object.values(tagsSortByCriteria).map((el) => (
              <MenuItem key={el.value} value={el.value}>{el.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {renderTags()}
    </Stack>
  );
}
