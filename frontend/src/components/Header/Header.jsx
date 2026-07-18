import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { getLoggedInUser } from '../../utilities/authUtilities';
import { api, endpoints } from '../../api';
import { host } from '../../host';

import {
  AppBar,
  Toolbar,
  Grid,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import UserAccountMenu from './UserAccountMenu';
import makeStyles from '@mui/styles/makeStyles';
import logo from '../../assets/zotLogoColored.svg';
import logoxs from '../../assets/zotLogoColoredSmall.svg';

const useStyles = makeStyles((theme) => ({
  appBar: {
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    borderBottom: '1px solid #e5e7eb',
  },
  toolbar: {
    position: 'relative',
    minHeight: '56px',
    padding: '0 1.5rem',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
  },
  leftNav: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    zIndex: 1,
  },
  logo: {
    height: '32px',
    marginRight: '2rem',
    display: 'flex',
    alignItems: 'center',
  },
  logoImg: {
    height: '100%',
  },
  navLink: {
    color: '#6b7280',
    fontSize: '0.875rem',
    fontWeight: 500,
    textDecoration: 'none',
    marginRight: '1.5rem',
    padding: '6px 0',
    borderBottom: '2px solid transparent',
    transition: 'color 0.2s, border-color 0.2s',
    '&:hover': {
      color: '#0F2139',
      borderBottomColor: '#2563eb',
    },
  },
  activeNavLink: {
    color: '#0F2139',
    fontSize: '0.875rem',
    fontWeight: 600,
    textDecoration: 'none',
    marginRight: '1.5rem',
    padding: '6px 0',
    borderBottom: '2px solid #2563eb',
  },
  searchBox: {
    left: '50%',
    maxWidth: '480px',
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '42vw',
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      '& fieldset': {
        borderColor: 'transparent',
      },
      '&:hover': {
        backgroundColor: '#f9fafb',
        '& fieldset': {
          borderColor: 'transparent',
        },
      },
      '&.Mui-focused': {
        backgroundColor: '#f9fafb',
        boxShadow: 'none',
        '& fieldset': {
          borderColor: 'transparent',
        },
      },
    },
    '& .MuiInputBase-input': {
      color: '#0F2139',
      padding: '8px 12px',
      fontSize: '0.875rem',
      '&::placeholder': {
        color: '#9ca3af',
        opacity: 1,
      },
    },
  },
  rightActions: {
    alignItems: 'center',
    display: 'flex',
    gap: '0.5rem',
    marginLeft: 'auto',
    minWidth: '120px',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  signInBtn: {
    border: '1px solid #2563eb',
    borderRadius: '8px',
    color: '#2563eb',
    fontSize: '0.875rem',
    fontWeight: 600,
    textTransform: 'none',
    padding: '6px 20px',
    backgroundColor: 'transparent',
    '&:hover': {
      backgroundColor: '#2563eb',
      color: '#ffffff',
      borderColor: '#2563eb',
    },
  },
}));

function Header({ setSearchCurrentValue = () => {} }) {
  const classes = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [authEnabled, setAuthEnabled] = useState(false);

  useEffect(() => {
    api
      .get(`${host()}${endpoints.authConfig}`)
      .then((response) => {
        const authConfig = response.data?.http?.auth || {};
        localStorage.setItem('authConfig', JSON.stringify(authConfig));
        setAuthEnabled(Object.keys(authConfig).length > 0);
      })
      .catch(() => {
        const authConfig = JSON.parse(localStorage.getItem('authConfig')) || {};
        setAuthEnabled(Object.keys(authConfig).length > 0);
      });
  }, []);

  const handleSignInClick = () => {
    navigate('/login');
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      navigate(`/explore?search=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  return (
    <AppBar position="sticky" className={classes.appBar} elevation={1}>
      <Toolbar className={classes.toolbar}>
        <div className={classes.leftNav}>
          <div className={classes.logo}>
            <Link to="/home">
              <picture>
                <source media="(min-width:600px)" srcSet={logo} />
                <img alt="Registry" src={logoxs} className={classes.logoImg} />
              </picture>
            </Link>
          </div>

          <Link to="/home" className={location.pathname === '/home' ? classes.activeNavLink : classes.navLink}>
            首页
          </Link>
          <Link to="/explore" className={location.pathname.startsWith('/explore') ? classes.activeNavLink : classes.navLink}>
            探索
          </Link>
        </div>

        <Box className={classes.searchBox}>
          <TextField
            fullWidth
            placeholder="搜索镜像..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9ca3af', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Box className={classes.rightActions}>
          {authEnabled && getLoggedInUser() ? (
            <UserAccountMenu />
          ) : authEnabled ? (
            <Button className={classes.signInBtn} onClick={handleSignInClick}>
              登录
            </Button>
          ) : null}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
