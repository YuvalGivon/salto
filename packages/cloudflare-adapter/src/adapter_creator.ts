/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createAdapter, credentials } from '@salto-io/adapter-components'
import { Credentials, credentialsType } from './auth'
import createChangeValidator from './change_validator'
import { DEFAULT_CONFIG, UserConfig } from './config'
import { createConnection } from './client/connection'
import { ADAPTER_NAME } from './constants'
import { createClientDefinitions, createDeployDefinitions, createFetchDefinitions } from './definitions'
import { pagination } from './definitions/requests'
import { Options } from './definitions/types'
import { REFERENCES } from './definitions/references'

const { defaultCredentialsFromConfig } = credentials

export const adapter = createAdapter<Credentials, Options, UserConfig>({
  adapterName: ADAPTER_NAME,
  authenticationMethods: {
    basic: {
      credentialsType,
    },
  },
  defaultConfig: DEFAULT_CONFIG,
  definitionsCreator: ({ clients, userConfig }) => ({
    clients: createClientDefinitions(clients),
    pagination,
    fetch: createFetchDefinitions(userConfig.fetch),
    deploy: createDeployDefinitions(),
    references: REFERENCES,
  }),
  operationsCustomizations: {
    connectionCreatorFromConfig: () => createConnection,
    credentialsFromConfig: defaultCredentialsFromConfig,
    // TODO add other customizations if needed (check which ones are available - e.g. additional filters)
    additionalChangeValidators: createChangeValidator,
  },
  // add names of clients that should be created (if undefined, the adapter wrapper will create them)
  initialClients: {
    main: undefined,
  },
  clientDefaults: {
    // From https://developers.cloudflare.com/fundamentals/api/reference/limits:
    // "The global rate limit for the Cloudflare API is 1200 requests per five minute period per user, and applies
    // cumulatively regardless of whether the request is made via the dashboard, API key, or API token."
    // The setting here is per minute, so we naively divide by 5 and conservatively take half of that, in case we are
    // given an actual user's API token, to not block their web UI access.
    maxRequestsPerMinute: 120,
  },
})
