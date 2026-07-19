// react global
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

// utility
import { api, endpoints } from '../../api';
import { host } from '../../host';
import { isEmpty, isObject } from 'lodash';

// components
import { Card, CardContent, CssBaseline } from '@mui/material';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Loading from '../Shared/Loading';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

import { GoogleLoginButton, GithubLoginButton, GitlabLoginButton, OIDCLoginButton } from './ThirdPartyLoginComponents';

// styling
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles(() => ({
  cardContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    padding: '2rem',
    boxSizing: 'border-box'
  },
  signinColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: '30rem'
  },
  backButton: {
    alignSelf: 'flex-start',
    color: '#52637A',
    fontSize: '0.9375rem',
    textTransform: 'none',
    marginBottom: '1rem',
    paddingLeft: 0,
    '&:hover': {
      backgroundColor: 'transparent',
      color: '#18324B'
    }
  },
  loginCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    background: '#FFFFFF',
    border: '0.0625rem solid #E1E6EC',
    boxShadow: '0 0.75rem 2rem rgba(24, 50, 75, 0.08)',
    borderRadius: '0.5rem'
  },
  loginCardContent: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    padding: '2.5rem',
    '&:last-child': {
      paddingBottom: '2.5rem'
    },
    '@media (max-width: 600px)': {
      padding: '1.5rem',
      '&:last-child': {
        paddingBottom: '1.5rem'
      }
    }
  },
  text: {
    color: '#14191F',
    width: '100%',
    fontSize: '1.75rem',
    lineHeight: '2.25rem',
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: '0.25rem'
  },
  subtext: {
    color: '#52637A',
    width: '100%',
    fontSize: '1rem',
    marginBottom: '2rem'
  },
  textField: {
    marginTop: 0,
    marginBottom: '1.25rem',
    '& .MuiOutlinedInput-root': {
      borderRadius: '0.375rem',
      backgroundColor: '#FFFFFF'
    }
  },
  textColor: {
    color: '#8596AD'
  },
  labelColor: {
    color: '#667C99',
    '&:focused': {
      color: '#667C99'
    }
  },
  continueButton: {
    textTransform: 'none',
    background: '#E86038',
    color: '#FFFFFF',
    fontSize: '1rem',
    fontWeight: '600',
    height: '3.125rem',
    borderRadius: '0.375rem',
    letterSpacing: 0,
    padding: 0,
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: '#C94B27',
      boxShadow: 'none'
    },
    '&.Mui-disabled': {
      backgroundColor: '#F0A088',
      color: '#FFFFFF'
    }
  },
  divider: {
    color: '#C2CBD6',
    marginBottom: '2rem',
    width: '100%'
  },
  thirdPartyLoginContainer: {
    width: '100%',
    marginBottom: '2rem'
  }
}));

export default function SignIn({ isLoggedIn, setIsLoggedIn, wrapperSetLoading = () => {} }) {
  const [usernameError, setUsernameError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [requestProcessing, setRequestProcessing] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethods, setAuthMethods] = useState({});
  const abortController = useMemo(() => new AbortController(), []);
  const navigate = useNavigate();
  const classes = useStyles();

  useEffect(() => {
    setIsLoading(true);
    if (isLoggedIn) {
      setIsLoading(false);
      wrapperSetLoading(false);
      navigate('/home');
    } else {
      api
        .get(`${host()}${endpoints.authConfig}`, abortController.signal)
        .then((response) => {
          if (response.data?.http && isEmpty(response.data?.http?.auth)) {
            localStorage.setItem('authConfig', '{}');
            setIsLoggedIn(true);
            navigate('/home');
          } else if (response.data?.http?.auth) {
            setAuthMethods(response.data?.http?.auth);
            localStorage.setItem('authConfig', JSON.stringify(response.data?.http?.auth));
            setIsLoading(false);
            wrapperSetLoading(false);
          }
          setIsLoading(false);
          wrapperSetLoading(false);
        })
        .catch((e) => {
          console.error(e);
          setIsLoading(false);
          wrapperSetLoading(false);
        });
    }
    return () => {
      abortController.abort();
    };
  }, []);

  const handleBasicAuth = () => {
    setRequestProcessing(true);
    let cfg = {};
    const token = btoa(username + ':' + password);
    cfg = {
      headers: {
        Authorization: `Basic ${token}`
      },
      withCredentials: host() !== window?.location?.origin
    };
    api
      .get(`${host()}/v2/`, abortController.signal, cfg)
      .then((response) => {
        if (response.status === 200) {
          setRequestProcessing(false);
          setRequestError(false);
          setIsLoggedIn(true);
          navigate('/home');
        }
      })
      .catch(() => {
        setRequestError(true);
        setRequestProcessing(false);
      });
  };

  const handleBasicAuthSubmit = () => {
    setRequestError(false);
    const isUsernameValid = handleUsernameValidation(username);
    const isPasswordValid = handlePasswordValidation(password);
    if (Object.keys(authMethods).includes('htpasswd') && isUsernameValid && isPasswordValid) {
      handleBasicAuth();
    }
  };

  const handleClick = (event) => {
    event.preventDefault();
    handleBasicAuthSubmit();
  };

  const handleClickExternalLogin = (event, provider) => {
    event.preventDefault();
    window.location.replace(
      `${host()}${endpoints.openidAuth}?callback_ui=${encodeURIComponent(
        window?.location?.origin
      )}/home&provider=${provider}`
    );
  };

  const handleUsernameValidation = (username) => {
    let isValid = true;
    if (username === '') {
      setUsernameError('请输入用户名');
      isValid = false;
    } else {
      setUsernameError(null);
    }
    return isValid;
  };

  const handlePasswordValidation = (password) => {
    let isValid = true;
    if (password === '') {
      setPasswordError('请输入密码');
      isValid = false;
    } else {
      setPasswordError(null);
    }
    return isValid;
  };

  const handleChange = (event, type) => {
    event.preventDefault();
    setRequestError(false);

    const val = event.target?.value;

    switch (type) {
      case 'username':
        setUsername(val);
        handleUsernameValidation(val);
        break;
      case 'password':
        setPassword(val);
        handlePasswordValidation(val);
        break;
      default:
        break;
    }
  };

  const renderThirdPartyLoginMethods = () => {
    let isGoogle = isObject(authMethods.openid?.providers?.google);
    let isGitlab = isObject(authMethods.openid?.providers?.gitlab);
    let isGithub = isObject(authMethods.openid?.providers?.github);
    let isOIDC = isObject(authMethods.openid?.providers?.oidc);
    let oidcName = authMethods.openid?.providers?.oidc?.name;

    return (
      <Stack direction="column" spacing="1rem" className={classes.thirdPartyLoginContainer}>
        {isGithub && <GithubLoginButton handleClick={handleClickExternalLogin} />}
        {isGoogle && <GoogleLoginButton handleClick={handleClickExternalLogin} />}
        {isGitlab && <GitlabLoginButton handleClick={handleClickExternalLogin} />}
        {isOIDC && <OIDCLoginButton handleClick={handleClickExternalLogin} oidcName={oidcName} />}
      </Stack>
    );
  };

  return (
    <div className={classes.cardContainer} data-testid="signin-container">
      {isLoading ? (
        <Loading />
      ) : (
        <div className={classes.signinColumn}>
          <Button className={classes.backButton} startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/home')}>
            返回仓库
          </Button>
          <Card className={classes.loginCard}>
            <CardContent className={classes.loginCardContent}>
              <CssBaseline />
              <Typography align="left" className={classes.text} component="h1" variant="h4">
                登录
              </Typography>
              <Typography align="left" className={classes.subtext} variant="body1" gutterBottom>
                欢迎回来，请登录
              </Typography>
              {renderThirdPartyLoginMethods()}
              {Object.keys(authMethods).length > 1 &&
                Object.keys(authMethods).includes('openid') &&
                Object.keys(authMethods.openid.providers).length > 0 && (
                  <Divider className={classes.divider} data-testid="openid-divider">
                    或
                  </Divider>
                )}
              {Object.keys(authMethods).includes('htpasswd') && (
                <Box component="form" onSubmit={handleClick} noValidate autoComplete="on">
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="username"
                    label="用户名"
                    name="username"
                    autoComplete="username"
                    className={classes.textField}
                    inputProps={{ className: classes.textColor }}
                    InputLabelProps={{ className: classes.labelColor }}
                    onInput={(e) => handleChange(e, 'username')}
                    error={usernameError != null}
                    helperText={usernameError}
                  />
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="输入密码"
                    type="password"
                    id="password"
                    autoComplete="current-password"
                    className={classes.textField}
                    inputProps={{ className: classes.textColor }}
                    InputLabelProps={{ className: classes.labelColor }}
                    onInput={(e) => handleChange(e, 'password')}
                    error={passwordError != null}
                    helperText={passwordError}
                  />
                  {requestError && (
                    <Alert style={{ marginBottom: 20 }} severity="error">
                      认证失败，请重试
                    </Alert>
                  )}
                  <div>
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      className={classes.continueButton}
                      disabled={requestProcessing}
                      data-testid="basic-auth-submit-btn"
                    >
                      {requestProcessing ? <CircularProgress size={22} color="inherit" /> : '登录'}
                    </Button>
                  </div>
                </Box>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
