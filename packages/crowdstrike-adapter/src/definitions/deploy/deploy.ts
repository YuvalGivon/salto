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
import * as preventionPolicyUtils from './types/prevention_policy'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({})
  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    PreventionPolicy: {
      recurseIntoPath: [
        {
          fieldPath: ['groups'],
          typeName: 'PreventionPolicyHostGroup',
          changeIdFields: ['resValue.value.id'],
          onActions: ['add', 'modify'],
        },
        {
          fieldPath: ['ioa_rule_groups'],
          typeName: 'PreventionPolicyIoaRuleGroup',
          changeIdFields: ['resValue.value.id'],
          onActions: ['add', 'modify'],
        },
      ],
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/policy/entities/prevention/v1',
                  method: 'post',
                },
                transformation: {
                  adjust: preventionPolicyUtils.reformatForDeploy,
                },
              },
              copyFromResponse: {
                additional: {
                  root: 'resources',
                  single: true,
                  pick: ['id'],
                },
              },
            },
            {
              request: preventionPolicyUtils.enablementRequest,
            },
          ],
          modify: [
            {
              condition: {
                transformForCheck: {
                  omit: ['groups', 'ioa-rule-groups'],
                },
              },
              request: {
                endpoint: {
                  path: '/policy/entities/prevention/v1',
                  method: 'patch',
                },
                transformation: {
                  adjust: preventionPolicyUtils.reformatForDeploy,
                },
              },
            },
            {
              request: preventionPolicyUtils.enablementRequest,
              condition: {
                transformForCheck: {
                  pick: ['enabled'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/policy/entities/prevention/v1',
                  method: 'delete',
                  queryArgs: {
                    ids: '{id}',
                  },
                },
              },
            },
          ],
        },
      },
    },
    PreventionPolicyHostGroup: {
      // Sending the requests in parallel causes race conditions in the service.
      concurrency: 1,
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/policy/entities/prevention-actions/v1?action_name=add-host-group',
                  method: 'post',
                },
                transformation: {
                  adjust: preventionPolicyUtils.adjustPreventionPolicyAction('group_id'),
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/policy/entities/prevention-actions/v1?action_name=remove-host-group',
                  method: 'post',
                },
                transformation: {
                  adjust: preventionPolicyUtils.adjustPreventionPolicyAction('group_id'),
                },
              },
            },
          ],
        },
      },
    },

    PreventionPolicyIoaRuleGroup: {
      // Sending the requests in parallel causes race conditions in the service.
      concurrency: 1,
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/policy/entities/prevention-actions/v1?action_name=add-rule-group',
                  method: 'post',
                },
                transformation: {
                  adjust: preventionPolicyUtils.adjustPreventionPolicyAction('rule_group_id'),
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/policy/entities/prevention-actions/v1?action_name=remove-rule-group',
                  method: 'post',
                },
                transformation: {
                  adjust: preventionPolicyUtils.adjustPreventionPolicyAction('rule_group_id'),
                },
              },
            },
          ],
        },
      },
    },
  }
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
