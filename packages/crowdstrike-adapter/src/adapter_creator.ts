/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createAdapter, credentials as credentialUtils } from '@salto-io/adapter-components'
import { Credentials, credentialsType } from './auth'
import createChangeValidator from './change_validator'
import { DEFAULT_CONFIG, UserConfig } from './config'
import { createConnection } from './client/connection'
import { ADAPTER_NAME } from './constants'
import { createClientDefinitions, createDeployDefinitions, createFetchDefinitions } from './definitions'
import { pagination } from './definitions/requests'
import { Options } from './definitions/types'
import { REFERENCES } from './definitions/references'

const { defaultCredentialsFromConfig } = credentialUtils

export const adapter = createAdapter<Credentials, Options, UserConfig>({
  adapterName: ADAPTER_NAME,
  authenticationMethods: {
    basic: {
      credentialsType,
    },
  },
  defaultConfig: DEFAULT_CONFIG,
  definitionsCreator: ({ clients, userConfig, credentials }) => ({
    clients: createClientDefinitions(clients),
    pagination,
    fetch: createFetchDefinitions(userConfig.fetch, credentials),
    deploy: createDeployDefinitions(),
    references: REFERENCES,
  }),
  operationsCustomizations: {
    connectionCreatorFromConfig: () => createConnection,
    credentialsFromConfig: defaultCredentialsFromConfig,
    additionalChangeValidators: createChangeValidator,
  },
  initialClients: {
    main: undefined,
  },
  clientDefaults: {
    // Docs: https://falcon.us-2.crowdstrike.com/documentation/page/a2a7fc0e/crowdstrike-oauth2-based-apis#af41971e
    // The rate limit is 6000 requests per minute per account. We set it to 50% of that to be safe.
    // TODO(SALTO-7601): Use the rate limit from the response headers instead of a fixed value.
    maxRequestsPerMinute: 3000,
  },
})
