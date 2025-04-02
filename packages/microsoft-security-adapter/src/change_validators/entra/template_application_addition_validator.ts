/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isAdditionChange, isInstanceElement } from '@salto-io/adapter-api'
import { entraConstants } from '../../constants'

const {
  TOP_LEVEL_TYPES: { APPLICATION_TYPE_NAME },
} = entraConstants

export const templateApplicationAdditionValidator: ChangeValidator = async changes => {
  const applicationAdditions = changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(elem => elem.elemID.typeName === APPLICATION_TYPE_NAME)

  return applicationAdditions
    .filter(instance => instance.value.applicationTemplateId !== undefined)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot create an application from a template.',
      detailedMessage:
        'Creating an application from a template is currently not supported in Salto. Please use the Entra admin center to create the application.',
    }))
}
