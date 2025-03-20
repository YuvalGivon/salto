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
    // The object that contains the reference actually contains the full value of the referenced object, plus some additional fields.
    // We omit the full value of the referenced object, and only keep the id, and then this rule converts it to a reference.
    // TODO: Handle the resolution of the ID into the full object when deploying (if needed).
    src: { field: 'id', parentTypes: ['AccessApplication__policies'] },
    serializationStrategy: 'id',
    target: { type: 'AccessPolicy' },
  },
  {
    src: {
      field: 'id',
      parentTypes: [
        'AccessPolicy__exclude__group',
        'AccessPolicy__include__group',
        'AccessPolicy__require__group',
        'AccessGroup__exclude__group',
        'AccessGroup__include__group',
        'AccessGroup__require__group',
      ],
    },
    serializationStrategy: 'id',
    target: { type: 'AccessGroup' },
  },
  {
    src: { field: 'id', parentTypes: ['AccessApplication__gateway_rules'] },
    serializationStrategy: 'id',
    target: { type: 'GatewayRule' },
  },
  {
    src: { field: 'aud', parentTypes: ['CertificateAuthority'] },
    serializationStrategy: 'aud',
    target: { type: 'AccessApplication' },
  },
  {
    src: { field: 'id', parentTypes: ['Rule__action_parameters'] },
    serializationStrategy: 'id',
    target: { type: 'Ruleset' },
  },
  {
    src: { field: 'id', parentTypes: ['Rule__action_parameters__overrides__rules'] },
    serializationStrategy: 'id',
    target: { type: 'Rule' },
  },
]

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  serializationStrategyLookup: {
    aud: {
      serialize: ({ ref }) => ref.value.value.aud,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'aud',
    },
  },

  fieldsToGroupBy: ['id', 'aud'],
}
