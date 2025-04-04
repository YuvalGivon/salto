/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ChangeValidator, getChangeData, isAdditionChange, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { entraConstants } from '../../constants'

const log = logger(module)
const {
  TOP_LEVEL_TYPES: { SECURITY_DEFAULTS_TYPE_NAME, CONDITIONAL_ACCESS_POLICY_TYPE_NAME },
} = entraConstants

export const securityDefaultsEnabledValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.error('failed to run securityDefaultsEnabledValidator because elementsSource is undefined')
    return []
  }

  const conditionalAccessPolicyAdditions = changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(elem => elem.elemID.typeName === CONDITIONAL_ACCESS_POLICY_TYPE_NAME)

  if (_.isEmpty(conditionalAccessPolicyAdditions)) {
    return []
  }

  const isSecurityDefaultsEnabled = (
    await getInstancesFromElementSource(elementsSource, [SECURITY_DEFAULTS_TYPE_NAME])
  ).find(elem => elem.value.isEnabled === true)

  if (!isSecurityDefaultsEnabled) {
    return []
  }

  return conditionalAccessPolicyAdditions.map(instance => ({
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot add conditional access policy when security defaults are enabled.',
    detailedMessage:
      'Conditional access policies are not supported when security defaults are enabled. Disable security defaults to add a conditional access policy.',
  }))
}
