/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { SAVED_SEARCH_TYPE_NAME } from '../constants'

/**
 * The `name` field of a saved search is functioning as an id.
 * Modifiying the name of a saved search will result in the creation of a new saved search with the new name.
 * To avoid this behavior, we block modifications of the `name` field.
 */
export const savedSearchNameValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === SAVED_SEARCH_TYPE_NAME)
    .filter(change => change.data.before.value.name !== getChangeData(change).value.name)
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Error',
      message: 'Cannot modify saved search name',
      detailedMessage:
        'Splunk does not support renaming existing saved searches. Please revert the name change to proceed with the deployment, or create a new saved search with the desired name.',
    }))
