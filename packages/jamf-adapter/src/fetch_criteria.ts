/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { elements as elementUtils } from '@salto-io/adapter-components'
import {
  MAC_APPLICATION_TYPE_NAME,
  MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME,
  OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
  POLICY_TYPE_NAME,
  RESTRICTED_SOFTWARE_TYPE_NAME,
} from './constants'

const jamfNameCriterionCreator = (): elementUtils.query.QueryCriterion => {
  const typesWithGeneralNameField = new Set([
    MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME,
    MAC_APPLICATION_TYPE_NAME,
    OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
    POLICY_TYPE_NAME,
    RESTRICTED_SOFTWARE_TYPE_NAME,
  ])
  return ({ instance, value }): boolean =>
    typesWithGeneralNameField.has(instance.elemID.typeName)
      ? elementUtils.query.fieldCriterionCreator('general.name')({ instance, value })
      : elementUtils.query.nameCriterion({ instance, value })
}

export default {
  name: jamfNameCriterionCreator(),
}
