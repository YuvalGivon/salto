/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import { SUPPORT_ADDRESS_TYPE_NAME } from '../../../constants'

// this transformer adds the production_email field to the support address this is needed to be able to add this field in the elemId
export const transform: definitions.AdjustFunctionSingle = async ({ value, typeName }) => {
  if (!lowerdashValues.isPlainObject(value)) {
    throw new Error('unexpected value for queue item, not transforming')
  }
  if (typeName === SUPPORT_ADDRESS_TYPE_NAME) {
    const productionEmail = _.get(value, 'email')
    return {
      value: {
        ...value,
        production_email: productionEmail,
      },
    }
  }

  return {
    value,
  }
}
