/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, references as referenceUtils } from '@salto-io/adapter-components'
import { ReferenceContextStrategies, Options, CustomReferenceSerializationStrategyName } from './types'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  {
    src: { field: 'rule_ids', parentTypes: ['FirewallRuleGroup'] },
    serializationStrategy: 'family',
    target: { type: 'FirewallRule' },
  },
  {
    src: { field: 'policy_ids', parentTypes: ['FirewallRuleGroup'] },
    serializationStrategy: 'id',
    target: { type: 'FirewallPolicy' },
  },
  // FirewallRule__fields is a list of fields. This rule should only catch fields with name == 'network_location'
  {
    src: { field: 'values', parentTypes: ['FirewallRule__fields'] },
    serializationStrategy: 'id',
    target: { typeContext: 'fieldName' },
  },
  {
    src: { field: 'locations', parentTypes: ['NetworkLocationPrecedence'] },
    serializationStrategy: 'id',
    target: { type: 'NetworkLocation' },
  },
  {
    src: {
      field: 'groups',
      parentTypes: [
        'DeviceControlPolicy',
        'MachineLearningExclusion',
        'FirewallMember',
        'SensorVisibilityExclusion',
        'FirewallPolicy',
        'SensorUpdatePolicy',
      ],
    },
    serializationStrategy: 'id',
    target: { type: 'HostGroup' },
  },
  {
    src: { field: 'host_groups', parentTypes: ['CertBasedExclusion'] },
    serializationStrategy: 'id',
    target: { type: 'HostGroup' },
  },
  {
    src: { field: 'members', parentTypes: ['HostGroup'] },
    serializationStrategy: 'device_id',
    target: { type: 'Device' },
  },
  {
    src: { field: 'rule_ids', parentTypes: ['CustomIoaRuleGroup'] },
    serializationStrategy: 'id',
    target: { type: 'CustomIoaRule' },
  },
]

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  serializationStrategyLookup: {
    family: {
      serialize: ({ ref }) => ref.value.value.family,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'family',
    },
    device_id: {
      serialize: ({ ref }) => ref.value.value.device_id,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'device_id',
    },
  },
  fieldsToGroupBy: ['id', 'name', 'family', 'device_id'],
  contextStrategyLookup: {
    fieldName: referenceUtils.neighborContextGetter({
      contextFieldName: 'name',
      getLookUpName: async ({ ref }) => ref.elemID.name,
      contextValueMapper: (fieldName: string) => (fieldName === 'network_location' ? 'NetworkLocation' : undefined),
    }),
  },
}
