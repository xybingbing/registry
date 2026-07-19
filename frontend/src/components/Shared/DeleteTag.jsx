import React, { useState } from 'react';
import { IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

// components
import DeleteTagConfirmDialog from 'components/Shared/DeleteTagConfirmDialog';

export default function DeleteTag(props) {
  const { repo, tag, onTagDelete, className } = props;
  const [open, setOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const onConfirm = () => {
    onTagDelete(tag);
  };

  return (
    <React.Fragment>
      <IconButton className={className} onClick={handleClickOpen}>
        <DeleteIcon />
      </IconButton>
      <DeleteTagConfirmDialog
        onClose={handleClose}
        open={open}
        title={`确认删除 ${repo}:${tag}？`}
        onConfirm={onConfirm}
      />
    </React.Fragment>
  );
}
