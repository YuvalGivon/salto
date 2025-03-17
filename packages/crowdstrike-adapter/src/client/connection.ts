/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AccountInfo } from '@salto-io/adapter-api'
import { client as clientUtils, auth as authUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials } from '../auth'

const log = logger(module)

const VALIDATE_CREDENTIALS_URL = '/user-management/queries/roles/v1'

const validateCredentials = async ({
  connection,
}: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    // TODO identify production accounts
    await connection.get(VALIDATE_CREDENTIALS_URL)
    return { accountId: '' }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions =>
  clientUtils.axiosConnection({
    retryOptions,
    baseURLFunc: async ({ baseUrl }) => baseUrl,
    authParamsFunc: async ({ baseUrl: baseURL, clientId, clientSecret }: Credentials) =>
      authUtils.oauthClientCredentialsBearerToken({
        endpoint: '/oauth2/token',
        baseURL,
        clientId,
        clientSecret,
        retryOptions,
      }),
    credValidateFunc: validateCredentials,
  })
