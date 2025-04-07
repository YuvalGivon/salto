/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { transform } from '../../../../src/definitions/fetch/transforms/support_address_adjuster'
import { SUPPORT_ADDRESS_TYPE_NAME } from '../../../../src/constants'

describe('support_address_adjuster', () => {
  it('should add production_email field with value from email field', async () => {
    const value = {
      email: 'test@example.com',
      name: 'Test Support',
    }
    const finalValue = await transform({ value, context: {}, typeName: SUPPORT_ADDRESS_TYPE_NAME })
    expect(finalValue).toEqual({
      value: {
        email: 'test@example.com',
        name: 'Test Support',
        production_email: 'test@example.com',
      },
    })
  })

  it('should add production_email field even if email is undefined', async () => {
    const value = {
      name: 'Test Support',
    }
    const finalValue = await transform({ value, context: {}, typeName: SUPPORT_ADDRESS_TYPE_NAME })
    expect(finalValue).toEqual({
      value: {
        name: 'Test Support',
        production_email: undefined,
      },
    })
  })

  it('should not modify the value for a different type', async () => {
    const value = {
      email: 'test@example.com',
      name: 'Test Support',
    }
    const finalValue = await transform({ value, context: {}, typeName: 'some_other_type' })
    expect(finalValue).toEqual({
      value: {
        email: 'test@example.com',
        name: 'Test Support',
      },
    })
  })

  it('should throw an error if value is not a plain object', async () => {
    const value = 'not an object'
    await expect(transform({ value, context: {}, typeName: SUPPORT_ADDRESS_TYPE_NAME })).rejects.toThrow(
      'unexpected value for queue item, not transforming',
    )
  })
})
