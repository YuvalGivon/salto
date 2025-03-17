/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { Values } from '@salto-io/adapter-api'
import { OS_X_CONFIGURATION_PROFILE_TYPE_NAME } from '../../../src/constants'
import { preparePayloadsForDeploy } from '../../../src/definitions/deploy/configuration_profile_utils'

type PayloadValue = Record<string, unknown>

describe('preparePayloadsForDeploy', () => {
  it('should throw an error if value is not a record', async () => {
    const value = 'not a record'
    await expect(
      preparePayloadsForDeploy({
        value: value as unknown as Values,
        context: {} as definitions.deploy.ChangeAndExtendedContext,
        typeName: OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
      }),
    ).rejects.toThrow('Expected value to be a record')
  })

  it('should convert JSON payloads to XML format and contain all keys and values', async () => {
    const inputPayloads: PayloadValue = {
      payload_type: 'com.apple.webClip.managed',
      payload_version: 1,
      payload_identifier: 'com.example.profile',
      payload_uuid: '12345678-1234-1234-1234-123456789012',
      payload_display_name: 'Test Profile',
      password: 'securePassword',
      max_inactivity: 10,
    }

    const value = {
      general: {
        payloads: inputPayloads,
      },
      other_field: 'test',
    }

    const result = await preparePayloadsForDeploy({
      value,
      context: {} as definitions.deploy.ChangeAndExtendedContext,
      typeName: OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
    })

    const payloads = (result as Values).value.general.payloads as Values
    const expectedXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>payload_type</key>
    <string>com.apple.webClip.managed</string>
    <key>payload_version</key>
    <integer>1</integer>
    <key>payload_identifier</key>
    <string>com.example.profile</string>
    <key>payload_uuid</key>
    <string>12345678-1234-1234-1234-123456789012</string>
    <key>payload_display_name</key>
    <string>Test Profile</string>
    <key>password</key>
    <string>securePassword</string>
    <key>max_inactivity</key>
    <integer>10</integer>
  </dict>
</plist>`

    expect(payloads).toEqual(expectedXml)
    expect((result as Values).value.other_field).toBe('test')
  })
})
