/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { savedSearchNameValidator } from '../src/change_validators/saved_search_name'
import { SAVED_SEARCH_TYPE_NAME, ADAPTER_NAME } from '../src/constants'

describe('savedSearchNameValidator', () => {
  const savedSearchType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, SAVED_SEARCH_TYPE_NAME),
  })

  const createSavedSearch = (name: string, search = 'index=main | stats count'): InstanceElement =>
    new InstanceElement(`test_${name}`, savedSearchType, {
      name,
      search,
      description: 'A test search',
    })

  it('should create an error message when modifying a saved search name', async () => {
    const originalSavedSearch = createSavedSearch('Original Search Name')
    const modifiedSavedSearch = createSavedSearch('New Search Name')

    const changes = [
      toChange({
        before: originalSavedSearch,
        after: modifiedSavedSearch,
      }),
    ]

    const errors = await savedSearchNameValidator(changes)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toEqual('Cannot modify saved search name')
    expect(errors[0].severity).toEqual('Error')
  })

  it('should not create an error when modifying fields other than name', async () => {
    const originalSavedSearch = createSavedSearch('Original Search Name', 'index=main | stats count')
    const modifiedSavedSearch = createSavedSearch('Original Search Name', 'index=main | stats count by host')
    modifiedSavedSearch.value.description = 'An updated test search'

    const changes = [
      toChange({
        before: originalSavedSearch,
        after: modifiedSavedSearch,
      }),
    ]

    const errors = await savedSearchNameValidator(changes)
    expect(errors).toHaveLength(0)
  })

  it('should not create an error for addition changes', async () => {
    const newSavedSearch = createSavedSearch('New Search Name')

    const changes = [
      toChange({
        before: undefined,
        after: newSavedSearch,
      }),
    ]

    const errors = await savedSearchNameValidator(changes)
    expect(errors).toHaveLength(0)
  })

  it('should not create an error for deletion changes', async () => {
    const savedSearch = createSavedSearch('Search To Delete')

    const changes = [
      toChange({
        before: savedSearch,
        after: undefined,
      }),
    ]

    const errors = await savedSearchNameValidator(changes)

    expect(errors).toHaveLength(0)
  })
})
