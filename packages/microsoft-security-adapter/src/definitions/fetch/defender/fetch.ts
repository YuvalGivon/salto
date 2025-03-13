/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { Options } from '../../types'
import { GRAPH_BETA_PATH } from '../../requests/clients'
import { FetchCustomizations } from '../shared/types'
import { defenderConstants } from '../../../constants'
import { createCustomizationsWithBasePathForFetch } from '../shared/utils'
import { DEFAULT_TRANSFORMATION, ID_FIELD_TO_HIDE, NAME_ID_FIELD } from '../shared/defaults'
import { ASSIGNMENT_FIELD_CUSTOMIZATION } from '../shared/assignments'

const {
  // Type names
  TOP_LEVEL_TYPES: { INDICATOR_TYPE_NAME, POLICY_TEMPLATE_TYPE_NAME },
  POLICY_ASSIGNMENTS_NESTED_TYPE,
  POLICY_TYPE_TO_TEMPLATE_FAMILY_NAME,
  // Fields
  ASSIGNMENTS_FIELD_NAME,
  // Other
  SERVICE_BASE_URL,
} = defenderConstants

const graphBetaCustomizations: FetchCustomizations = {
  [INDICATOR_TYPE_NAME]: {
    // TODO SALTO-7573: it will be deprecated in April 2026, use the security API instead
    resource: {
      directFetch: true,
    },
    requests: [
      {
        endpoint: {
          path: '/security/tiIndicators',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            {
              fieldName: 'description',
            },
          ],
        },
        // TODO SALTO-7573: add service url once we use the security API
        allowEmptyArrays: true,
      },
      fieldCustomizations: ID_FIELD_TO_HIDE,
    },
  },
  [POLICY_TEMPLATE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/deviceManagement/configurationPolicyTemplates',
        },
        transformation: DEFAULT_TRANSFORMATION,
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [NAME_ID_FIELD, { fieldName: 'platforms' }, { fieldName: 'displayVersion' }],
        },
        path: {
          pathParts: [
            { parts: [{ fieldName: 'platforms' }] },
            { parts: [NAME_ID_FIELD, { fieldName: 'displayVersion' }] },
          ],
        },
        alias: { aliasComponents: [NAME_ID_FIELD] },
      },
      fieldCustomizations: {
        ...ID_FIELD_TO_HIDE,
        baseId: {
          hide: true,
        },
        version: {
          hide: true,
        },
        settingTemplateCount: {
          omit: true,
        },
      },
    },
  },
  ...Object.assign(
    {},
    // If rate limiting occurs, consider fetching all the policies in a single request and separating them afterwards
    ...Object.entries(POLICY_TYPE_TO_TEMPLATE_FAMILY_NAME).map(([typeName, templateFamilyName]) => ({
      [typeName]: {
        requests: [
          {
            endpoint: {
              path: '/deviceManagement/configurationPolicies',
              queryArgs: {
                $filter: `templateReference/TemplateFamily eq '${templateFamilyName}'`,
                $expand: 'assignments',
              },
            },
            transformation: {
              ...DEFAULT_TRANSFORMATION,
              omit: ['assignments@odata.context', 'settingCount'],
            },
          },
        ],
        resource: {
          directFetch: true,
        },
        element: {
          topLevel: {
            isTopLevel: true,
            elemID: {
              parts: [{ fieldName: 'name' }],
            },
            path: {
              pathParts: [{ parts: [{ fieldName: 'platforms' }] }, { parts: [{ fieldName: 'name' }] }],
            },
            alias: { aliasComponents: [{ fieldName: 'name' }] },
            serviceUrl: {
              baseUrl: SERVICE_BASE_URL,
              path: '/policy-inventory/{id}?implementationType=DcV2',
            },
            allowEmptyArrays: true,
          },
          fieldCustomizations: {
            ...ID_FIELD_TO_HIDE,
            [ASSIGNMENTS_FIELD_NAME]: ASSIGNMENT_FIELD_CUSTOMIZATION,
          },
        },
      },
    })),
  ),
  ...Object.assign(
    {},
    ...POLICY_ASSIGNMENTS_NESTED_TYPE.map(typeName => ({
      [typeName]: {
        resource: {
          directFetch: false,
        },
        element: {
          fieldCustomizations: {
            id: {
              omit: true,
            },
            sourceId: {
              omit: true,
            },
          },
        },
      },
    })),
  ),
}

export const createDefenderCustomizations = (): Record<
  string,
  definitions.fetch.InstanceFetchApiDefinitions<Options>
> => createCustomizationsWithBasePathForFetch(graphBetaCustomizations, GRAPH_BETA_PATH)
