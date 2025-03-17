/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'

/**
 * Convert a list of IDs to an object with that list, so that it can be processed correctly.
 *
 * A common CrowdStrike pattern is to have a /queries endpoint which retuns a list of IDs, to be later sent to an
 * /entities endpoint to get the full objects. The first endpoint returns a bare list, but we expect endpoints to return
 * objects, so we convert the list to an object with a single field.
 *
 * @param typeName
 * @param value
 */
export const convertIdListToObject: definitions.TransformDefinition = {
  pick: ['resources'],
  adjust: async ({ typeName, value }) => {
    validatePlainObject(value, typeName)
    if (!Array.isArray(value?.resources)) {
      return []
    }
    return value?.resources.map(ids => ({ value: { ids } }))
  },
}
