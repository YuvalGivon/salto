/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions, deployment } from '@salto-io/adapter-components'
import { ClientOptions } from '..'
import { AdditionalAction } from '../types'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({})
  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {}
  return _.merge(standardRequestDefinitions, customDefinitions)
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
