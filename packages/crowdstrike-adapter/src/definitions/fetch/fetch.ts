/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { UserFetchConfig } from '../../config'
import { Options } from '../types'
import { Credentials } from '../../auth'
import { convertIdListToObject, convertGroupSummaryToIdList } from './transforms'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const COMMON_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  // ID fields
  ...[
    'id',
    'customer_id',
    'cid', // same as customer_id
  ].reduce((acc: Record<string, definitions.fetch.ElementFieldCustomization>, fieldName: string) => {
    acc[fieldName] = { hide: true }
    return acc
  }, {}),

  // Audit fields
  // Yes, all of these are actually used...
  ...[
    'created_by',
    'created_timestamp',
    'created_on',
    'CreatedAt',
    'modified_by',
    'modified_timestamp',
    'modified_on',
    'UpdatedAt',
    'last_modified',
    'last_seen',
  ].reduce((acc: Record<string, definitions.fetch.ElementFieldCustomization>, fieldName: string) => {
    acc[fieldName] = { omit: true }
    return acc
  }, {}),
}

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  PreventionPolicy: {
    requests: [
      {
        endpoint: {
          path: '/policy/combined/prevention/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [NAME_ID_FIELD, { fieldName: 'platform_name' }] },
        serviceUrl: {
          path: '/policies/prevention/windows/detail/{id}/Settings',
        },
      },
      fieldCustomizations: {
        id: { hide: true },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  SensorUpdatePolicy: {
    requests: [
      {
        endpoint: {
          path: '/policy/combined/sensor-update/v2',
        },
        transformation: {
          root: 'resources',
          adjust: convertGroupSummaryToIdList,
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [NAME_ID_FIELD, { fieldName: 'platform_name' }] },
        serviceUrl: {
          path: '/configuration/sensor-update/policies/{id}',
        },
      },
      fieldCustomizations: {
        id: { hide: true },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  FirewallPolicy: {
    requests: [
      {
        endpoint: {
          path: '/policy/combined/firewall/v1',
        },
        transformation: {
          root: 'resources',
          adjust: convertGroupSummaryToIdList,
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [NAME_ID_FIELD, { fieldName: 'platform_name' }] },
        serviceUrl: {
          path: '/policies/firewallv2/windows/detail/{id}/Settings',
        },
      },
      fieldCustomizations: {
        id: { hide: true },
        rule_set_id: { hide: true }, // same as id
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  FirewallMember: {
    requests: [
      {
        endpoint: {
          path: '/policy/combined/firewall-members/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [NAME_ID_FIELD, { fieldName: 'platform_name' }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  FirewallRuleGroupIds: {
    requests: [
      {
        endpoint: {
          path: '/fwmgr/queries/rule-groups/v1',
        },
        transformation: convertIdListToObject,
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        FirewallRuleGroup: {
          typeName: 'FirewallRuleGroup',
          context: {
            args: {
              ids: { root: 'ids' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true, // We just use this to get the group rule ID list.
      },
      fieldCustomizations: {
        ids: { hide: true },
        FirewallRuleGroup: {
          standalone: {
            typeName: 'FirewallRuleGroup',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  FirewallRuleGroup: {
    requests: [
      {
        endpoint: {
          path: '/fwmgr/entities/rule-groups/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: false,
      recurseInto: {
        FirewallRule: {
          typeName: 'FirewallRule',
          context: {
            args: {
              ids: { root: 'rule_ids' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [NAME_ID_FIELD, { fieldName: 'platform_name' }] },
        serviceUrl: {
          path: '/policies/firewallv2/windows/rule-group/windows/{id}/Rules',
        },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
        FirewallRule: {
          standalone: {
            typeName: 'FirewallRule',
            addParentAnnotation: true,
            // ReferenceFromParent here doesn't keep the original order, which is important as the rules have precedence.
            // We'll instead use the original rule_ids field to reference the rules as that list is ordered correctly.
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },

  // TODO: References from FirewallRuleGroup uses `family` and not `id`, need to figure out what is used for deploy.
  FirewallRule: {
    requests: [
      {
        endpoint: {
          path: '/fwmgr/entities/rules/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          path: '/policies/firewallv2/windows/rule-group/windows/{_parent.0.id}/Rules/Rules/{id}',
        },
      },
      fieldCustomizations: {
        rule_group: { omit: true }, // Contains a summary of the rule group. Hidden as the parent reference is enough.
        id: { hide: true },
        family: { hide: true },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  NetworkLocationPrecedence: {
    requests: [
      {
        endpoint: {
          path: '/fwmgr/queries/network-locations/v1',
        },
        transformation: {
          rename: [{ from: 'resources', to: 'locations', onConflict: 'override' }],
          pick: ['locations'],
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        NetworkLocation: {
          typeName: 'NetworkLocation',
          context: {
            args: {
              ids: { root: 'locations' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
        serviceUrl: {
          path: '/configuration-v2/firewall/network-locations',
        },
      },
      fieldCustomizations: {
        NetworkLocation: {
          standalone: {
            typeName: 'NetworkLocation',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  NetworkLocation: {
    requests: [
      {
        endpoint: {
          path: '/fwmgr/entities/network-locations-details/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [NAME_ID_FIELD, { fieldName: 'platform_name' }] },
        serviceUrl: {
          path: '/configuration-v2/firewall/network-locations/edit/{id}',
        },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  MachineLearningExclusionIds: {
    requests: [
      {
        endpoint: {
          path: '/policy/queries/ml-exclusions/v1',
        },
        transformation: convertIdListToObject,
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        FirewallRuleGroup: {
          typeName: 'MachineLearningExclusion',
          context: {
            args: {
              ids: { root: 'ids' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true, // We just use this to get the group rule ID list.
      },
      fieldCustomizations: {
        ids: { hide: true },
        FirewallRuleGroup: {
          standalone: {
            typeName: 'MachineLearningExclusion',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  MachineLearningExclusion: {
    requests: [
      {
        endpoint: {
          path: '/policy/entities/ml-exclusions/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
          adjust: convertGroupSummaryToIdList,
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'id' }] },
        serviceUrl: {
          path: '/configuration-v2/exclusions/machine-learning/{id}/summary',
        },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  CertBasedExclusionIds: {
    requests: [
      {
        endpoint: {
          path: '/exclusions/queries/cert-based-exclusions/v1',
        },
        transformation: convertIdListToObject,
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        FirewallRuleGroup: {
          typeName: 'CertBasedExclusion',
          context: {
            args: {
              ids: { root: 'ids' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true, // We just use this to get the group rule ID list.
      },
      fieldCustomizations: {
        ids: { hide: true },
        FirewallRuleGroup: {
          standalone: {
            typeName: 'CertBasedExclusion',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  CertBasedExclusion: {
    requests: [
      {
        endpoint: {
          path: '/exclusions/entities/cert-based-exclusions/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'id' }] },
        serviceUrl: {
          path: '/configuration-v2/exclusions/certificates/{id}/summary',
        },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  SensorVisibilityExclusionIds: {
    requests: [
      {
        endpoint: {
          path: '/policy/queries/sv-exclusions/v1',
        },
        transformation: convertIdListToObject,
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        FirewallRuleGroup: {
          typeName: 'SensorVisibilityExclusion',
          context: {
            args: {
              ids: { root: 'ids' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true,
      },
      fieldCustomizations: {
        ids: { hide: true },
        FirewallRuleGroup: {
          standalone: {
            typeName: 'SensorVisibilityExclusion',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  SensorVisibilityExclusion: {
    requests: [
      {
        endpoint: {
          path: '/policy/entities/sv-exclusions/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
          adjust: convertGroupSummaryToIdList,
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'id' }] },
        serviceUrl: {
          path: '/configuration-v2/exclusions/sensor-visibility/{id}/summary',
        },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },
  DeviceControlPolicy: {
    requests: [
      {
        endpoint: {
          path: '/policy/combined/device-control/v1',
        },
        transformation: {
          root: 'resources',
          adjust: convertGroupSummaryToIdList,
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [NAME_ID_FIELD, { fieldName: 'platform_name' }] },
        serviceUrl: {
          path: '/policies/device-control/windows/detail/{id}/Settings',
        },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  // TODO: `assignment_rule` attribute may contains device IDs that should be references.
  HostGroup: {
    requests: [
      {
        endpoint: {
          path: '/devices/combined/host-groups/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        members: {
          typeName: 'HostGroupMember',
          single: true,
          context: {
            args: {
              hostGroupId: { root: 'id' },
            },
          },
        },
      },
      mergeAndTransform: {
        rename: [{ from: 'members.devices', to: 'members', onConflict: 'override' }],
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [NAME_ID_FIELD, { fieldName: 'platform_name' }] },
        serviceUrl: {
          path: '/hosts/groups-new/edit/{id}',
        },
      },
      fieldCustomizations: {
        // Device members are considered data, so we omit them for now.
        members: { omit: true },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  // Note: this is fetched as recurseInto from HostGroup as its `members` field, but it's marked as omitted.
  HostGroupMember: {
    requests: [
      {
        endpoint: {
          path: '/devices/queries/host-group-members/v1',
          queryArgs: {
            id: '{hostGroupId}',
          },
        },
        transformation: {
          rename: [{ from: 'resources', to: 'devices', onConflict: 'override' }],
          pick: ['devices'],
        },
      },
    ],
    resource: {
      directFetch: false,
    },
  },

  Device: {
    requests: [
      {
        endpoint: {
          path: '/devices/combined/devices/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      serviceIDFields: ['device_id'],
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'hostname' }] },
      },
    },
  },

  CustomIoaRuleGroupIds: {
    requests: [
      {
        endpoint: {
          path: '/ioarules/queries/rule-groups/v1',
        },
        transformation: convertIdListToObject,
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        CustomIoaRuleGroup: {
          typeName: 'CustomIoaRuleGroup',
          context: {
            args: {
              ids: { root: 'ids' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true, // We just use this to get the group rule ID list.
      },
      fieldCustomizations: {
        ids: { hide: true },
        CustomIoaRuleGroup: {
          standalone: {
            typeName: 'CustomIoaRuleGroup',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  CustomIoaRuleGroup: {
    requests: [
      {
        endpoint: {
          // Note: this endpoint is not covered by the Swagger spec, deduced from the UI.
          path: '/ioarules/entities/rule-groups/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
          adjust: async ({ value }) => {
            validatePlainObject(value, 'CustomIoaRuleGroup')
            // rule_ids uses a relative ID (1, 2, 3...) that isn't globally unique. We concat it to the group ID to make
            // it unique and referenceable.
            const ruleIds = Array.isArray(value?.rule_ids)
              ? value?.rule_ids.map((ruleId: string) => `${value?.id}/${ruleId}`)
              : value?.rules
            // We similarly need to adjust the rules to include a single field with the group ID and the rule ID.
            const rules = Array.isArray(value?.rules)
              ? value.rules.map(rule => ({ ...rule, id: `${value?.id}/${rule.instance_id}` }))
              : value?.rules
            return { value: { ...value, rules, rule_ids: ruleIds } }
          },
        },
      },
    ],
    resource: {
      directFetch: false,
      recurseInto: {
        FirewallRule: {
          typeName: 'CustomIoaRule',
          context: {
            args: {
              ids: { root: 'rule_ids' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          path: '/configuration/custom-ioa-groups/{id}/rules',
        },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
        rules: {
          standalone: {
            typeName: 'CustomIoaRule',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },

  CustomIoaRule: {
    resource: {
      directFetch: false,
      serviceIDFields: ['rulegroup_id', 'instance_id'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: {
          path: '/configuration/custom-ioa-groups/{rulegroup_id}/rules/{instance_id}',
        },
      },
      fieldCustomizations: {
        id: { hide: true },
        family: { hide: true },
        rulegroup_id: { hide: true }, // references its parent
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  CloudConnectAwsAccount: {
    requests: [
      {
        endpoint: {
          path: '/cloud-connect-cspm-aws/entities/account/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['ID'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'account_id' }] },
        serviceUrl: {
          path: '/cloud-security/registration-v2/aws',
        },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
        aws_permissions_status: {
          sort: {
            properties: [{ path: 'name' }],
          },
        },
      },
    },
  },

  // TODO: this is untested, we need to connect an actual account
  CloudConnectGcpAccount: {
    requests: [
      {
        endpoint: {
          path: '/cloud-connect-cspm-gcp/entities/account/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['ID'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'account_id' }] },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },

  // TODO: this is untested, we need to connect an actual account
  CloudConnectAzureAccount: {
    requests: [
      {
        endpoint: {
          path: '/cloud-connect-cspm-azure/entities/account/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['ID'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'account_id' }] },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
    },
  },
})

export const createFetchDefinitions = (
  _fetchConfig: UserFetchConfig,
  credentials: Credentials,
): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
          serviceUrl: {
            baseUrl: credentials.baseUrl.replace('api', 'falcon'),
          },
        },
      },
    },
    customizations: createCustomizations(),
  },
})
