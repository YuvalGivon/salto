/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, deployment } from '@salto-io/adapter-components'
import { ClientOptions } from '..'
import { AdditionalAction } from '../types'
import { SAVED_SEARCH_TYPE_NAME } from '../../constants'
import { adjustSavedSearchToPostFormat } from './transformations/saved_searches'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const customDefinitions: Record<string, InstanceDeployApiDefinitions> = {
    [SAVED_SEARCH_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/services/saved/searches',
                  method: 'post',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    output_mode: 'json',
                  },
                },
                transformation: {
                  adjust: adjustSavedSearchToPostFormat(true),
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/services/saved/searches/{name}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/services/saved/searches/{name}',
                  method: 'post',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    output_mode: 'json',
                  },
                },
                transformation: {
                  adjust: adjustSavedSearchToPostFormat(false),
                },
              },
            },
          ],
        },
      },
    },
  }
  return customDefinitions
}

export const createDeployDefinitions = (): definitions.deploy.DeployApiDefinitions<never, ClientOptions> => ({
  instances: {
    default: {
      requestsByAction: {
        default: {
          request: {
            context: deployment.helpers.DEFAULT_CONTEXT,
          },
        },
        customizations: {},
      },
      changeGroupId: deployment.grouping.selfGroup,
    },
    customizations: createCustomizations(),
  },
  dependencies: [],
})
