/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { references as referenceUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { ReferenceContextStrategies, CustomReferenceSerializationStrategyName } from '../types'
import { defenderConstants } from '../../constants'

const { recursiveNestedTypeName } = fetchUtils.element

const {
  TOP_LEVEL_TYPES: { POLICY_TEMPLATE_TYPE_NAME },
  POLICY_TYPE_NAMES,
} = defenderConstants

export const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  {
    src: {
      field: 'templateId',
      parentTypes: POLICY_TYPE_NAMES.map(name => recursiveNestedTypeName(name, 'templateReference')),
    },
    target: { type: POLICY_TEMPLATE_TYPE_NAME },
    serializationStrategy: 'id',
  },
]
