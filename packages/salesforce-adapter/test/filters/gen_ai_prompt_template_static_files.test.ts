/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, StaticFile, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/gen_ai_prompt_template_static_files'
import { defaultFilterContext } from '../utils'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import { FilterWith } from './mocks'
import { buildContext } from '../../src/config/context/context'

describe('genAiPromptTemplate static files filter', () => {
  const TEMPLATE_CONTENT_1 = 'template content 1'
  const TEMPLATE_CONTENT_2 = 'template content 2'
  const TEMPLATE_CONTENT_3 = 'template content 3'
  const TEMPLATE_NAME = 'TestTemplate'

  type FilterType = FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  let filter: FilterType
  let multiVersionTemplate: InstanceElement

  const expectedStaticFile1 = new StaticFile({
    filepath: 'salesforce/Records/GenAiPromptTemplate/TestTemplate/version_1.txt',
    content: Buffer.from(TEMPLATE_CONTENT_1),
  })
  const expectedStaticFile2 = new StaticFile({
    filepath: 'salesforce/Records/GenAiPromptTemplate/TestTemplate/version_2.txt',
    content: Buffer.from(TEMPLATE_CONTENT_2),
  })

  beforeEach(() => {
    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        context: buildContext({
          fetchParams: { target: [] },
        }),
      },
    }) as FilterType
  })

  describe('onFetch', () => {
    beforeEach(() => {
      multiVersionTemplate = createInstanceElement(
        {
          fullName: TEMPLATE_NAME,
          templateVersions: [{ content: TEMPLATE_CONTENT_1 }, { content: TEMPLATE_CONTENT_2 }],
        },
        mockTypes.GenAiPromptTemplate,
      )
    })

    it('should convert from string to static file', async () => {
      const expectedTemplateVersionsValue = [{ content: expectedStaticFile1 }, { content: expectedStaticFile2 }]
      await filter.onFetch([multiVersionTemplate])
      expect(multiVersionTemplate.value.templateVersions).toEqual(expectedTemplateVersionsValue)
    })
  })

  describe('deploy', () => {
    beforeEach(() => {
      multiVersionTemplate = createInstanceElement(
        {
          fullName: TEMPLATE_NAME,
          templateVersions: [
            { content: Buffer.from(TEMPLATE_CONTENT_1) },
            { content: Buffer.from(TEMPLATE_CONTENT_2) },
            { content: TEMPLATE_CONTENT_3 },
          ],
        },
        mockTypes.GenAiPromptTemplate,
      )
    })

    it('should convert from buffer to string on preDeploy and, if content was static file on preDeploy, convert from string to static file onDeploy', async () => {
      const expectedTemplateVersionsValuePreDeploy = [
        { content: TEMPLATE_CONTENT_1 },
        { content: TEMPLATE_CONTENT_2 },
        { content: TEMPLATE_CONTENT_3 },
      ]
      const expectedTemplateVersionsValueDeploy = [
        { content: expectedStaticFile1 },
        { content: expectedStaticFile2 },
        { content: TEMPLATE_CONTENT_3 },
      ]
      const changes = [toChange({ after: multiVersionTemplate })]
      await filter.preDeploy(changes)
      expect(multiVersionTemplate.value.templateVersions).toEqual(expectedTemplateVersionsValuePreDeploy)
      await filter.onDeploy(changes)
      expect(multiVersionTemplate.value.templateVersions).toEqual(expectedTemplateVersionsValueDeploy)
    })
  })
})
