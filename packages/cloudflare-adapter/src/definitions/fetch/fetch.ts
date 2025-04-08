/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { validatePlainObject } from '@salto-io/adapter-utils'
import { definitions } from '@salto-io/adapter-components'
import { UserFetchConfig } from '../../config'
import { Options } from '../types'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

// Note: hiding fields inside arrays is not supported, and can result in a corrupted workspace.
// when in doubt, it's best to hide fields only for relevant types, or to omit them.
const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  // hide
  last_updated: {
    hide: true,
  },
  modified_on: {
    hide: true,
  },
  updated_at: {
    hide: true,
  },
  created_on: {
    hide: true,
  },
}

const recurseIntoWithAccountId = (typeName: string): Record<string, definitions.fetch.RecurseIntoDefinition> => ({
  [typeName]: {
    typeName,
    context: {
      args: {
        accountId: { root: 'id' },
        accountOrZoneId: { root: 'id' },
        accountsOrZones: { adjust: async () => ({ value: 'accounts' }) },
      },
    },
  },
})

const recurseIntoWithZoneId = (typeName: string): Record<string, definitions.fetch.RecurseIntoDefinition> => ({
  [typeName]: {
    typeName,
    context: {
      args: {
        zoneId: { root: 'id' },
        accountOrZoneId: { root: 'id' },
        accountsOrZones: { adjust: async () => ({ value: 'zones' }) },
      },
    },
  },
})

const defaultStandaloneConfig = (typeName: string): Record<string, definitions.fetch.ElementFieldCustomization> => ({
  [typeName]: {
    standalone: {
      typeName,
      addParentAnnotation: true,
      referenceFromParent: false,
      nestPathUnderParent: true,
    },
  },
})

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  Account: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/accounts',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        ...recurseIntoWithAccountId('Ruleset'),
        ...recurseIntoWithAccountId('AccessGroup'),
        ...recurseIntoWithAccountId('AccessApplication'),
        ...recurseIntoWithAccountId('GatewayRule'),
        ...recurseIntoWithAccountId('GatewayList'),
        ...recurseIntoWithAccountId('Location'),
        ...recurseIntoWithAccountId('AccessPolicy'),
        ...recurseIntoWithAccountId('GatewayConfiguration'),
        ...recurseIntoWithAccountId('CertificateAuthority'),
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        alias: { aliasComponents: [{ fieldName: 'name' }] },
        serviceUrl: { path: '/{id}/home' },
      },
      fieldCustomizations: {
        id: { hide: true },
        ...defaultStandaloneConfig('Ruleset'),
        ...defaultStandaloneConfig('AccessGroup'),
        ...defaultStandaloneConfig('AccessApplication'),
        ...defaultStandaloneConfig('GatewayRule'),
        ...defaultStandaloneConfig('GatewayList'),
        ...defaultStandaloneConfig('Location'),
        ...defaultStandaloneConfig('AccessPolicy'),
        ...defaultStandaloneConfig('GatewayConfiguration'),
        ...defaultStandaloneConfig('CertificateAuthority'),
      },
    },
  },

  Zone: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/zones',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        ...recurseIntoWithZoneId('ZoneSettings'),
        ...recurseIntoWithZoneId('DnsRecord'),
        ...recurseIntoWithZoneId('Ruleset'),
        ...recurseIntoWithZoneId('UserAgentBlockingRule'),
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        alias: { aliasComponents: [{ fieldName: 'name' }] },
        serviceUrl: { path: '/{account.id}/{name}' },
      },
      fieldCustomizations: {
        id: { hide: true },
        ...defaultStandaloneConfig('ZoneSettings'),
        ...defaultStandaloneConfig('DnsRecord'),
        ...defaultStandaloneConfig('Ruleset'),
        ...defaultStandaloneConfig('UserAgentBlockingRule'),
      },
    },
  },

  ZoneSettings: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/zones/{zoneId}/settings',
        },
        transformation: {
          root: 'result',
          adjust: async ({ value, context }) => {
            validatePlainObject(value, 'ZoneSettings')
            return {
              // Add the (hidden) zoneId to the value, so we can use it as a service ID.
              value: { ...value, zoneId: context.zoneId },
            }
          },
        },
      },
    ],
    resource: {
      directFetch: false,
      serviceIDFields: ['id', 'zoneId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'id' }], extendsParent: true },
        alias: {
          aliasComponents: [
            { fieldName: 'id' },
            { constant: 'setting for' },
            { fieldName: '_parent.0', referenceFieldName: 'name' },
          ],
        },
      },
      fieldCustomizations: {
        zoneId: { hide: true },
      },
    },
  },

  DnsRecord: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/zones/{zoneId}/dns_records',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'type' }, { fieldName: 'name' }], extendsParent: true },
        alias: { aliasComponents: [{ fieldName: 'type' }, { fieldName: 'name' }] },
        serviceUrl: { path: '/{account.id}/{name}' },
      },
      fieldCustomizations: {
        id: { hide: true },
        zone_id: { hide: true },
      },
    },
  },

  Ruleset: {
    requests: [
      {
        endpoint: {
          // Rulesets exists under both Zone and Account. We adjust the path based on the parent context, set according to its type.
          path: '/client/v4/{accountsOrZones}/{accountOrZoneId}/rulesets',
        },
        transformation: {
          root: 'result',
          adjust: async ({ value, context }) => {
            validatePlainObject(value, 'Ruleset')
            return {
              // Add the (hidden) zoneId to the value, so we can use it as a service ID.
              value: {
                ...value,
                accountsOrZones: context.accountsOrZones,
                accountOrZoneId: context.accountOrZoneId,
              },
            }
          },
        },
      },
    ],
    resource: {
      directFetch: false,
      // Some managed ruleset appear in all Zones / Accounts with the same ID. It might be better to have them in one
      // place and reference them, but for now we keep them duplicated (read-only) with unique service IDs.
      // TODO(SALTO-7583): Avoid duplicated "managed" rulesets and rules.
      serviceIDFields: ['id', 'accountsOrZones', 'accountOrZoneId'],
      recurseInto: {
        Rule: {
          typeName: 'Rule',
          context: {
            args: {
              rulesetId: { root: 'id' },
              rulesetRule: { root: 'phase' },
              kind: { root: 'kind' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'name' }, { fieldName: 'phase' }, { fieldName: 'kind' }], extendsParent: true },
        alias: { aliasComponents: [{ fieldName: 'name' }, { fieldName: 'phase' }, { fieldName: 'kind' }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        accountsOrZones: { hide: true },
        accountOrZoneId: { hide: true },
        Rule: {
          standalone: {
            typeName: 'Rule',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },

  Rule: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/{accountsOrZones}/{accountOrZoneId}/rulesets/{rulesetId}',
        },
        transformation: {
          root: 'result.rules',
          adjust: async ({ value, context }) => {
            validatePlainObject(value, 'Rule')
            return {
              // Add the (hidden) zoneId to the value, so we can use it as a service ID.
              value: {
                ...value,
                phase: context.rulesetRule,
                kind: context.kind,
                accountsOrZones: context.accountsOrZones,
                accountOrZoneId: context.accountOrZoneId,
              },
            }
          },
        },
      },
    ],
    resource: {
      directFetch: false,
      // Some managed ruleset appear in all Zones / Accounts with the same ID. It might be better to have them in one
      // place and reference them, but for now we keep them duplicated (read-only) with unique service IDs.
      serviceIDFields: ['id', 'phase', 'kind', 'accountsOrZones', 'accountOrZoneId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'description' }, { fieldName: 'id' }], extendsParent: true },
        alias: { aliasComponents: [{ fieldName: 'description' }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        ref: { hide: true }, // has the same value as `id`.
        phase: { hide: true },
        kind: { hide: true },
        accountsOrZones: { hide: true },
        accountOrZoneId: { hide: true },
        version: { hide: true }, // Very noisy, hiding to reduce diffs.
      },
    },
  },

  UserAgentBlockingRule: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/zones/{zoneId}/firewall/ua_rules',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'description' }], extendsParent: true },
        alias: { aliasComponents: [{ fieldName: 'description' }] },
        serviceUrl: { path: '/{_parent.0.account.id}/{_parent.0.name}/security/waf/tools' },
      },
      fieldCustomizations: {
        id: { hide: true },
      },
    },
  },

  // TODO: The following fields should be template expressions: traffic, identity, device_posture
  GatewayRule: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/accounts/{accountId}/gateway/rules',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        created_at: { hide: true },
      },
    },
  },

  GatewayList: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/accounts/{accountId}/gateway/lists',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: false,
      recurseInto: {
        items: {
          typeName: 'GatewayItem',
          context: { args: { listId: { root: 'id' } } },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
        alias: { aliasComponents: [{ fieldName: 'name' }] },
        serviceUrl: { baseUrl: 'https://dash.cloudflare.com/', path: '{_parent.0.id}/team/lists' },
      },
      fieldCustomizations: {
        id: { hide: true },
        created_at: { hide: true },
        items: {
          fieldType: 'GatewayItem',
        },
      },
    },
  },

  GatewayItem: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/accounts/{accountId}/gateway/lists/{listId}/items',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    element: {
      fieldCustomizations: {
        // Undo the default hiding as it causes merge errors for lists.
        created_at: { hide: false },
      },
    },
    resource: {
      directFetch: false,
      serviceIDFields: [],
    },
  },

  Location: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/accounts/{accountId}/gateway/locations',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true },
        created_at: { hide: true },
      },
    },
  },

  AccessPolicy: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/accounts/{accountId}/access/policies',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true },
        uid: { hide: true }, // has the same value as `id`.
        created_at: { hide: true },
      },
    },
  },

  AccessGroup: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/{accountsOrZones}/{accountOrZoneId}/access/groups',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true },
        uid: { hide: true }, // has the same value as `id`.
        created_at: { hide: true },
      },
    },
  },

  // I'm getting 404 on this... and can't find it in the UI, should maybe delete
  GatewayConfiguration: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/accounts/{accountId}/gateway/configurations',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true },
      },
    },
  },

  AccessApplication: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/{accountsOrZones}/{accountOrZoneId}/access/apps',
        },
        transformation: {
          root: 'result',
          adjust: async ({ value }) => {
            validatePlainObject(value, 'AccessApplication')
            // Remove everything but `id` and `precedence` from the `policies` array. We're replace `id` with a reference,
            // so we don't need to show the full policy. `precedence` per-application so we keep it.
            return {
              value: {
                ...value,
                policies: value.policies?.map((policy: { id: string; precedence: number }) => ({
                  id: policy.id,
                  precedence: policy.precedence,
                })),
              },
            }
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
        elemID: { extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true },
        created_at: { hide: true },
        uid: { hide: true }, // has the same value as `id`.
        aud: { hide: true }, // another unique identifier, used for references.
      },
    },
  },

  AccessApplication__saas_app: {
    element: {
      fieldCustomizations: {
        created_at: { hide: true },
      },
    },
  },

  // TODO: The "aud" field is a reference to Application via its "aud" field.
  CertificateAuthority: {
    requests: [
      {
        endpoint: {
          path: '/client/v4/{accountsOrZones}/{accountOrZoneId}/access/apps/ca',
        },
        transformation: {
          root: 'result',
        },
      },
    ],
    resource: {
      directFetch: false,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'id' }], extendsParent: true },
      },
      fieldCustomizations: {
        id: { hide: true },
      },
    },
  },
})

export const createFetchDefinitions = (
  _fetchConfig: UserFetchConfig,
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
            baseUrl: 'https://dash.cloudflare.com/',
          },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
