import React, { useMemo } from 'react';
import { Typography, Stack } from '@mui/material';
import { isEmpty } from 'lodash';
import { getStrongestSignature, getAllAuthorsOfSignatures } from 'utilities/vulnerabilityAndSignatureCheck';

function SignatureTooltip({ signatureInfo }) {
  const strongestSignature = useMemo(() => getStrongestSignature(signatureInfo));

  return isEmpty(strongestSignature) ? (
    <Typography>未签名</Typography>
  ) : (
    <Stack direction="column">
      <Typography>工具: {strongestSignature?.tool || '未知'}</Typography>
      <Typography>签名者: {getAllAuthorsOfSignatures(signatureInfo) || '未知'}</Typography>
    </Stack>
  );
}

export default SignatureTooltip;
