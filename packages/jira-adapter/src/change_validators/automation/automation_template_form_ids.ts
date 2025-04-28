/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import Joi from 'joi'
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isAdditionChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE } from '../../constants'

type FormComponent = {
  component: string
  type: string
  value: {
    templateFormsConfig: {
      templateFormIds: number[]
    }
  }
}

const FORM_COMPONENT_SCHEMA = Joi.object({
  component: Joi.string().required(),
  type: Joi.string().required(),
  value: Joi.object({
    templateFormsConfig: Joi.object({
      templateFormIds: Joi.array().items(Joi.number()).required(),
    })
      .required()
      .unknown(true),
  })
    .required()
    .unknown(true),
}).unknown(true)

const isFormComponent = createSchemeGuard<FormComponent[]>(FORM_COMPONENT_SCHEMA)

const hasTemplateFormByIdChange = (
  beforeFormComponents: FormComponent[],
  afterFormComponents: FormComponent[],
): boolean => {
  const afterForms = new Set(
    afterFormComponents.flatMap(component => component.value.templateFormsConfig.templateFormIds),
  )
  if (afterForms.size === 0) return false // all forms were removed
  const beforeForms = new Set(
    beforeFormComponents.flatMap(component => component.value.templateFormsConfig.templateFormIds),
  )
  return beforeForms.size !== afterForms.size || [...beforeForms].some(id => !afterForms.has(id))
}

/**
 * Warn the user about deploying an automation that references forms by internal ids
 * In case of removal (of the whole automation, or all the forms) we assume the action is correct
 * We warn only in case we identify a new form id or removing a single form id in the after state
 */
export const automationTemplateFormIdsValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
    .filter(change =>
      hasTemplateFormByIdChange(
        isAdditionChange(change) ? [] : change.data.before.value.components?.filter(isFormComponent) ?? [],
        change.data.after.value.components?.filter(isFormComponent) ?? [],
      ),
    )
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Warning' as SeverityLevel,
      message: 'Deploying automation with template form internal IDs.',
      detailedMessage:
        "This automation might reference forms by internal IDs that don't exist in the target Jira environment. Review and edit them if required. Learn More: https://help.salto.io/en/articles/11087953-automation-reference-forms-by-internal-ids-that-do-not-match-the-target-environment",
    }))
