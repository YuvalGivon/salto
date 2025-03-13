/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { customlistType } from '../../src/autogen/types/standard_types/customlist'
import NetsuiteClient from '../../src/client/client'
import { INTERNAL_ID } from '../../src/constants'
import setServiceUrl from '../../src/service_url/custom_list'

describe('setCustomListsUrls', () => {
  const client = {
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient
  const customlist = customlistType().type

  it('should set the right url', async () => {
    const elements = [
      new InstanceElement('customlist1', customlist, {
        scriptid: 'customlist1',
        [INTERNAL_ID]: '1',
      }),
    ]
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/custlist.nl?id=1',
    )
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', customlist, { scriptid: 'someScriptID2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
