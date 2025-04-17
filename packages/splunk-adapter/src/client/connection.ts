/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { AccountInfo } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials } from '../auth'

const log = logger(module)

const VALIDATE_CREDENTIALS_URL = '/services/authentication/current-context'

// TODO: SALTO-7744 determine if this is a production environment
const validateCredentials = async ({
  connection,
  credentials,
}: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    await connection.get(VALIDATE_CREDENTIALS_URL)
    return { accountId: credentials.subdomain }
  } catch (error) {
    log.error(
      'Failed to validate credentials, error: %s, stack: %s',
      safeJsonStringify({ data: error?.response?.data, status: error?.response?.status }),
      error.stack,
    )
    throw new clientUtils.UnauthorizedError(error)
  }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions =>
  clientUtils.axiosConnection({
    retryOptions,
    baseURLFunc: async ({ subdomain }: Credentials) => `https://${subdomain}.splunkcloud.com:8089`,
    authParamsFunc: async ({ token }: Credentials) => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    credValidateFunc: validateCredentials,
  })
