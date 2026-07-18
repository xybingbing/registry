import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Select,
  MenuItem,
  DialogActions,
  Button,
  InputLabel
} from '@mui/material';
import { sortByCriteria } from 'utilities/sortCriteria.js';

function FilterDialog(props) {
  const { open, setOpen, sortValue, setSortValue, renderFilterCards } = props;

  const handleSortChange = (event) => {
    setSortValue(event.target.value);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, color: '#0F2139' }}>筛选条件</DialogTitle>
      <DialogContent>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>排序方式</InputLabel>
          <Select label="排序方式" value={sortValue} onChange={handleSortChange} MenuProps={{ disableScrollLock: true }}>
            {Object.values(sortByCriteria).map((el) => (
              <MenuItem key={el.value} value={el.value}>{el.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {renderFilterCards()}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="contained" sx={{ borderRadius: '8px', textTransform: 'none' }}>
          应用
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default FilterDialog;
