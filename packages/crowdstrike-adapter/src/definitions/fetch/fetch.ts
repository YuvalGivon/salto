/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { concatAdjustFunctions, definitions } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { UserFetchConfig } from '../../config'
import { Options } from '../types'
import { Credentials } from '../../auth'
import { convertSummaryToIdList } from './transforms'

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
    'last_updated_on',
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
          adjust: concatAdjustFunctions(convertSummaryToIdList('groups'), convertSummaryToIdList('ioa_rule_groups')),
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
          adjust: convertSummaryToIdList('groups'),
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

  FirewallPolicyIds: {
    requests: [
      {
        endpoint: {
          path: '/policy/queries/firewall/v1',
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        FirewallPolicy: {
          typeName: 'FirewallPolicy',
          context: {
            args: {
              ids: { root: 'resources' },
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
        FirewallPolicy: {
          standalone: {
            typeName: 'FirewallPolicy',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },

  FirewallPolicy: {
    requests: [
      {
        endpoint: {
          path: '/policy/entities/firewall/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
          adjust: convertSummaryToIdList('groups'),
        },
      },
      // TODO check if still needed
      {
        endpoint: {
          path: '/fwmgr/entities/policies/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
          adjust: async ({ value }) => {
            validatePlainObject(value, 'FirewallPolicy')
            // Set `id` so that we can match the different fragments into a single element.
            return { value: { ...value, id: value.policy_id } }
          },
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
          path: '/policies/firewallv2/windows/detail/{id}/Settings',
        },
      },
      fieldCustomizations: {
        id: { hide: true },
        policy_id: { omit: true }, // same as id
        rule_set_id: { omit: true }, // same as id
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
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        FirewallRuleGroup: {
          typeName: 'FirewallRuleGroup',
          context: {
            args: {
              ids: { root: 'resources' },
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
          adjust: async ({ value }) => {
            validatePlainObject(value, 'FirewallRuleGroup')
            // A synthetic field to indicate if the rule group has rules, to avoid recurseInto on empty rule groups.
            const hasRules: string = value.rule_ids.length > 0 ? 'true' : 'false'
            return { value: { ...value, hasRules } }
          },
        },
      },
    ],
    resource: {
      directFetch: false,
      recurseInto: {
        FirewallRule: {
          typeName: 'FirewallRule',
          conditions: [
            {
              fromField: 'hasRules',
              match: ['true'],
            },
          ],
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
        hasRules: { omit: true },
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
      directFetch: false,
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
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        MachineLearningExclusion: {
          typeName: 'MachineLearningExclusion',
          context: {
            args: {
              ids: { root: 'resources' },
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
        MachineLearningExclusion: {
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
          adjust: convertSummaryToIdList('groups'),
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
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        CertBasedExclusion: {
          typeName: 'CertBasedExclusion',
          context: {
            args: {
              ids: { root: 'resources' },
            },
          },
        },
        ExclusionCertificate: {
          typeName: 'ExclusionCertificate',
          context: {
            args: {
              ids: { root: 'resources' },
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
        CertBasedExclusion: {
          standalone: {
            typeName: 'CertBasedExclusion',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
        ExclusionCertificate: {
          standalone: {
            typeName: 'ExclusionCertificate',
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
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
            {
              fieldName: 'status',
            },
          ],
        },
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
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        SensorVisibilityExclusion: {
          typeName: 'SensorVisibilityExclusion',
          context: {
            args: {
              ids: { root: 'resources' },
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
        SensorVisibilityExclusion: {
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
          adjust: convertSummaryToIdList('groups'),
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
          adjust: convertSummaryToIdList('groups'),
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
        elemID: { parts: [{ fieldName: 'hostname' }, { fieldName: 'device_id' }] },
      },
      fieldCustomizations: {
        ...COMMON_FIELD_CUSTOMIZATIONS,
        slow_changing_modified_timestamp: { omit: true },
      },
    },
  },

  IoaRuleGroup: {
    requests: [
      {
        endpoint: {
          path: '/ioarules/queries/rule-groups-full/v1',
        },
        transformation: {
          root: 'resources',
          adjust: async ({ value }) => {
            validatePlainObject(value, 'IoaRuleGroup')
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
      directFetch: true,
      recurseInto: {
        IoaRule: {
          typeName: 'IoaRule',
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
            typeName: 'IoaRule',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },

  IoaRule: {
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
          path: '/cloud-connect-aws/entities/account/v2',
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
  Action: {
    element: {
      fieldCustomizations: {},
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'id',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/iocs/entities/actions/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  CspmPolicySettings: {
    element: {
      fieldCustomizations: {
        created_at: {
          omit: true,
        },
        policy_id: {
          hide: true,
        },
        policy_timestamp: {
          omit: true,
        },
        updated_at: {
          omit: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
            {
              fieldName: 'cloud_provider',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/settings/entities/policy/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['policy_id'],
    },
  },
  ContentUpdatePolicy: {
    element: {
      fieldCustomizations: {
        cid: {
          omit: true,
        },
        created_by: {
          omit: true,
        },
        created_timestamp: {
          omit: true,
        },
        id: {
          hide: true,
        },
        modified_by: {
          omit: true,
        },
        modified_timestamp: {
          omit: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/policy/combined/content-update/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },

  CorrelationRuleIds: {
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/correlation-rules/queries/rules/v1',
        },
        transformation: {
          pick: ['resources'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  CorrelationRule: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/correlation-rules/entities/rules/v1',
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
      context: {
        dependsOn: {
          ids: {
            parentTypeName: 'CorrelationRuleIds',
            transformation: {
              root: 'resources',
            },
          },
        },
      },
      directFetch: true,
    },
  },
  CorrelationRule__notifications__config: {
    element: {
      fieldCustomizations: {
        cid: {
          omit: true,
        },
      },
    },
  },
  DefaultDeviceControlPolicy: {
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/policy/entities/default-device-control/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
      mergeAndTransform: {
        pick: ['id'],
      },
      serviceIDFields: [],
    },
  },
  DeliverySettings: {
    element: {
      fieldCustomizations: {
        cid: {
          omit: true,
        },
        created_at: {
          omit: true,
        },
        created_by: {
          omit: true,
        },
        id: {
          hide: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'delivery_type',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/delivery-settings/entities/delivery-settings/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  ExclusionCertificate: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/exclusions/entities/certificates/v1',
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
  },

  FirewallFieldIds: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        hide: true,
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/fwmgr/queries/firewall-fields/v1',
        },
        transformation: {
          pick: ['resources'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  FirewallField: {
    requests: [
      {
        endpoint: {
          path: '/fwmgr/entities/firewall-fields/v1',
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
      context: {
        dependsOn: {
          ids: {
            parentTypeName: 'FirewallFieldIds',
            transformation: {
              root: 'resources',
            },
          },
        },
      },
      directFetch: true,
    },
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'platform' }],
        },
      },
    },
  },
  HorizonScript: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/settings-discover/entities/gen/scripts/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },

  IoaRuleTypeIds: {
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/ioarules/queries/rule-types/v1',
        },
        transformation: {
          pick: ['resources'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  IoaRuleType: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
        ruletype_name: {
          omit: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
            {
              fieldName: 'platform',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/ioarules/entities/rule-types/v1',
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
      context: {
        dependsOn: {
          ids: {
            parentTypeName: 'IoaRuleTypeIds',
            transformation: {
              root: 'resources',
            },
          },
        },
      },
      directFetch: true,
    },
  },

  IdentityProtectionPolicyRuleIds: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/identity-protection/queries/policy-rules/v1',
        },
        transformation: {
          pick: ['resources'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  IdentityProtectionPolicyRule: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/identity-protection/entities/policy-rules/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
      },
    ],
    resource: {
      context: {
        dependsOn: {
          ids: {
            parentTypeName: 'IdentityProtectionPolicyRuleIds',
            transformation: {
              root: 'resources',
            },
          },
        },
      },
      directFetch: true,
    },
  },
  ImageAssessmentPolicy: {
    element: {
      fieldCustomizations: {
        created_at: {
          omit: true,
        },
        policy_id: {
          hide: true,
        },
        updated_at: {
          omit: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/container-security/entities/image-assessment-policies/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['policy_id'],
    },
  },
  ImageAssessmentPolicyExclusion: {
    element: {
      fieldCustomizations: {
        created_at: {
          omit: true,
        },
        id: {
          hide: true,
        },
        updated_at: {
          omit: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/container-security/entities/image-assessment-policy-exclusions/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  IocIndicatorIds: {
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/iocs/queries/indicators/v1',
        },
        transformation: {
          pick: ['resources'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  IocIndicator: {
    element: {
      fieldCustomizations: {
        created_by: {
          omit: true,
        },
        created_on: {
          omit: true,
        },
        id: {
          hide: true,
        },
        modified_by: {
          omit: true,
        },
        modified_on: {
          omit: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'type',
            },
            {
              fieldName: 'value',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/iocs/entities/indicators/v1',
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
      context: {
        dependsOn: {
          ids: {
            parentTypeName: 'IocIndicatorIds',
            transformation: {
              root: 'resources',
            },
          },
        },
      },
      directFetch: true,
    },
  },
  IoAExclusionPolicy: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/policy/queries/ioa-exclusions/v1',
        },
        transformation: {
          pick: ['resources'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },

  PatternSeverityIds: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        isTopLevel: true,
        hide: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/ioarules/queries/pattern-severities/v1',
        },
        transformation: {
          pick: ['resources'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  PatternSeverity: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/ioarules/entities/pattern-severities/v1',
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
      context: {
        dependsOn: {
          ids: {
            parentTypeName: 'PatternSeverityIds',
            transformation: {
              root: 'resources',
            },
          },
        },
      },
      serviceIDFields: ['name'],
      directFetch: true,
    },
  },
  Platform: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'label',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/fwmgr/entities/platforms/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  ResponsePolicy: {
    element: {
      fieldCustomizations: {
        cid: {
          omit: true,
        },
        created_by: {
          omit: true,
        },
        created_timestamp: {
          omit: true,
        },
        id: {
          hide: true,
        },
        modified_by: {
          omit: true,
        },
        modified_timestamp: {
          omit: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'platform_name',
            },
            {
              fieldName: 'name',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/policy/combined/response/v1',
        },
        transformation: {
          root: 'resources',
          adjust: convertSummaryToIdList('groups'),
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  SensorInstallerV1: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/sensors/combined/installers/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  SensorInstallerV2: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/sensors/combined/installers/v2',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  SensorUpdatePolicyBuild: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'platform',
            },
            {
              fieldName: 'stage',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/policy/combined/sensor-update-builds/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  SensorUpdatePolicy__groups: {
    element: {
      fieldCustomizations: {
        created_by: {
          omit: true,
        },
        created_timestamp: {
          omit: true,
        },
        modified_by: {
          omit: true,
        },
        modified_timestamp: {
          omit: true,
        },
      },
    },
  },
  SensorVisibilityExclusion__groups: {
    element: {
      fieldCustomizations: {
        created_by: {
          omit: true,
        },
        created_timestamp: {
          omit: true,
        },
        modified_by: {
          omit: true,
        },
        modified_timestamp: {
          omit: true,
        },
      },
    },
  },
  UserRole: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
      topLevel: {
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/user-management/combined/user-roles/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },
  WorkflowDefinition: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
        last_modified_timestamp: {
          omit: true,
        },
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'name',
            },
          ],
        },
        isTopLevel: true,
      },
      // TODO see if can add references, e.g. to actions.<name>.id and to entities inside the template language
    },
    requests: [
      {
        endpoint: {
          path: '/workflows/combined/definitions/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },

  PluginConfig: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
      topLevel: {
        elemID: {
          parts: [
            {
              fieldName: 'config.name',
            },
          ],
        },
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/plugins/combined/configs/v1',
        },
        transformation: {
          root: 'resources',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
  },

  // in the UI, also called File Integrity policies
  // TODO expand to additional types once we are able to test these properly

  FileVantagePolicyIds: {
    requests: [
      {
        endpoint: {
          path: '/filevantage/queries/policies/v1',
          queryArgs: {
            type: '{type}',
          },
        },
      },
    ],
    resource: {
      context: {
        fixed: {
          type: ['Windows', 'Linux', 'Mac'],
        },
      },
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true,
      },
    },
  },
  // TODO check how to retrieve and manage precedence - there's /filevantage/entities/policies-precedence/v1 PATCH for adjusting
  FileVantagePolicy: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
      topLevel: {
        isTopLevel: true,
      },
    },
    requests: [
      {
        endpoint: {
          path: '/filevantage/entities/policies/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
          adjust: concatAdjustFunctions(convertSummaryToIdList('host_groups'), convertSummaryToIdList('rule_groups')),
        },
      },
    ],
    resource: {
      context: {
        dependsOn: {
          ids: {
            parentTypeName: 'FileVantagePolicyIds',
            transformation: {
              root: 'resources',
            },
          },
        },
      },
      directFetch: true,
    },
  },

  FileVantageRuleGroupIds: {
    requests: [
      {
        endpoint: {
          path: '/filevantage/queries/rule-groups/v1',
          queryArgs: {
            type: '{type}',
          },
        },
      },
    ],
    resource: {
      context: {
        fixed: {
          type: ['WindowsFiles', 'WindowsRegistry', 'LinuxFiles', 'MacFiles'],
        },
      },
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        hide: true,
      },
    },
  },
  FileVantageRuleGroup: {
    element: {
      fieldCustomizations: {
        id: {
          hide: true,
        },
        FileVantageRule: {
          standalone: {
            typeName: 'FileVantageRule',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        // already covered by parent annotation from rules
        assigned_rules: {
          omit: true,
        },
        ...COMMON_FIELD_CUSTOMIZATIONS,
      },
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            NAME_ID_FIELD,
            {
              fieldName: 'type',
            },
          ],
        },
      },
    },
    requests: [
      {
        endpoint: {
          path: '/filevantage/entities/rule-groups/v1',
          queryArgs: {
            ids: '{ids}',
          },
        },
        transformation: {
          root: 'resources',
          adjust: concatAdjustFunctions(
            convertSummaryToIdList('policy_assignments'),
            convertSummaryToIdList('assigned_rules'),
          ),
        },
      },
    ],
    resource: {
      context: {
        dependsOn: {
          ids: {
            parentTypeName: 'FileVantageRuleGroupIds',
            transformation: {
              root: 'resources',
            },
          },
        },
      },
      directFetch: true,
      recurseInto: {
        FileVantageRule: {
          typeName: 'FileVantageRule',
          context: {
            args: {
              rule_group_id: { root: 'id' },
              assigned_rules: { root: 'assigned_rules' },
            },
          },
        },
      },
    },
  },
  // TODO check how to retrieve and manage precedence - there's /filevantage/entities/rule-groups-rule-precedence/v1 PATCH for adjusting
  FileVantageRule: {
    requests: [
      {
        endpoint: {
          path: '/filevantage/entities/rule-groups-rules/v1',
          queryArgs: {
            rule_group_id: '{rule_group_id}',
            ids: '{assigned_rules}',
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
        elemID: {
          parts: [
            {
              fieldName: 'path',
            },
            {
              fieldName: 'include',
            },
          ],
        },
      },
      fieldCustomizations: {
        id: { hide: true },
        ...COMMON_FIELD_CUSTOMIZATIONS,
        // already covered by parent annotation
        rule_group_id: { omit: true },
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
