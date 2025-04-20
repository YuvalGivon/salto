/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  isTemplateExpression,
  ReferenceExpression,
  TemplateExpression,
  TemplatePart,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { extractTemplate } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { BRAND_TYPE_NAME, SUPPORT_ADDRESS_TYPE_NAME } from '../constants'
import { FETCH_CONFIG } from '../config'

const log = logger(module)
export const INVALID_USERNAME = 'INVALID_USERNAME'

const referenceEmail = ({
  emailPart,
  brandInstances,
  referenceSubdomainForNonZendeskEmails,
}: {
  emailPart: string
  brandInstances: Record<string, InstanceElement>
  referenceSubdomainForNonZendeskEmails: boolean
}): TemplatePart[] => {
  // emailPart should be of the form {username}@{subdomain}.{domain} (usually zendesk.com)
  // zendesk subdomain cannot have a dot (.) in it.
  const splitEmail = emailPart.split(/^([^@]+)@([^.]+)\.(.+)$/).filter(v => !_.isEmpty(v))
  if (splitEmail.length !== 3) {
    return [emailPart]
  }
  const [username, subdomain, domain] = splitEmail
  if (domain !== 'zendesk.com' && !referenceSubdomainForNonZendeskEmails) {
    log.debug(`referenceSubdomainForNonZendeskEmails is false, so we will not reference ${emailPart}`)
    return [emailPart]
  }
  const elem = brandInstances[subdomain]
  if (elem !== undefined) {
    return [
      username,
      '@',
      new ReferenceExpression(elem.elemID.createNestedID('subdomain'), elem.value.subdomain),
      '.',
      domain,
    ]
  }
  return [emailPart]
}

const turnEmailToTemplateExpression = ({
  supportAddressInstance,
  brandList,
  referenceSubdomainForNonZendeskEmails,
}: {
  supportAddressInstance: InstanceElement
  brandList: Record<string, InstanceElement>
  referenceSubdomainForNonZendeskEmails: boolean
}): void => {
  const originalEmail = supportAddressInstance.value.email
  if (!_.isString(originalEmail)) {
    log.error(`email of ${supportAddressInstance.elemID.getFullName()} is not a string`)
    return
  }
  supportAddressInstance.value.email = extractTemplate(originalEmail, [], emailPart =>
    referenceEmail({
      emailPart,
      brandInstances: brandList,
      referenceSubdomainForNonZendeskEmails,
    }),
  )
}

export const replaceIfReferenceExpression = (part: TemplatePart): string =>
  isReferenceExpression(part) ? part.value : part

const templateToEmail = (
  change: Change<InstanceElement>,
  deployTemplateMapping: Record<string, TemplateExpression>,
): void => {
  const inst = getChangeData(change)
  const { email } = inst.value
  deployTemplateMapping[inst.elemID.getFullName()] = email
  if (isTemplateExpression(email)) {
    inst.value.email = email.parts.map(replaceIfReferenceExpression).join('')
  }
}

const extractUsernameFromEmail = (instance: InstanceElement): void => {
  const originalEmail = instance.value.email
  if (!_.isString(originalEmail)) {
    log.error(`email of ${instance.elemID.getFullName()} is not a string`)
    instance.value.username = INVALID_USERNAME
    return
  }
  const splitEmail = originalEmail.split('@')

  if (splitEmail[0] !== undefined) {
    // eslint-disable-next-line prefer-destructuring
    instance.value.username = splitEmail[0]
    return
  }
  instance.value.username = INVALID_USERNAME
}

// we need the production email for premium sandbox as the email looks like this: help-at-yourbusiness-com@sandboxsubdomain.zendesk.com
// instead of help@yourbusiness.zendesk.com
const extractProductionEmailFromEmail = (instance: InstanceElement): void => {
  const stringEmail = isTemplateExpression(instance.value.email)
    ? instance.value.email.parts.map(replaceIfReferenceExpression).join('')
    : instance.value.email
  const originalEmail = instance.value.email
  instance.value.production_email = originalEmail

  if (!_.isString(stringEmail)) {
    log.error(`email of ${instance.elemID.getFullName()} is not a string`)
    instance.value.production_email = originalEmail
    return
  }

  if (stringEmail.endsWith('zendesk.com')) {
    const localPart = stringEmail.split('@')[0]
    if (localPart.includes('-at-')) {
      instance.value.production_email = localPart.replace('-at-', '@').replace(/-/g, '.')
      log.debug(
        `production_email of ${instance.elemID.getFullName()} is ${instance.value.production_email} while email is ${stringEmail}`,
      )
    }
  }
}

const removeProductionEmail = (instance: InstanceElement): void => {
  delete instance.value.production_email
}

/**
 * 1. OnFetch and in onDeploy this filter turns the email in support_address to a template expression with a reference
 * to the brand's subdomain. only for zendesk emails. In preDeploy the template expressions are turned back to string.
 * 2. OnFetch, from the email username@subdomain.zendesk.com we will extract the username to a hidden field
 */
const filterCreator: FilterCreator = ({ config }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    name: 'supportAddress',
    onFetch: async (elements: Element[]): Promise<void> => {
      const instances = elements.filter(isInstanceElement)
      const supportAddressInstances = instances.filter(inst => inst.elemID.typeName === SUPPORT_ADDRESS_TYPE_NAME)
      const brandBySubdomains: Record<string, InstanceElement> = _.keyBy(
        instances
          .filter(inst => inst.elemID.typeName === BRAND_TYPE_NAME)
          .filter(inst => inst.value.subdomain !== undefined),
        (inst: InstanceElement): string => inst.value.subdomain,
      )
      supportAddressInstances.forEach(supportInstance => {
        extractUsernameFromEmail(supportInstance)
        turnEmailToTemplateExpression({
          supportAddressInstance: supportInstance,
          brandList: brandBySubdomains,
          referenceSubdomainForNonZendeskEmails: config[FETCH_CONFIG].referenceSubdomainForNonZendeskEmails ?? true,
        })
        extractProductionEmailFromEmail(supportInstance)
      })
    },
    preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      changes
        .filter(change => getChangeData(change).elemID.typeName === SUPPORT_ADDRESS_TYPE_NAME)
        .filter(isInstanceChange)
        .forEach(change => {
          templateToEmail(change, deployTemplateMapping)
          removeProductionEmail(getChangeData(change))
        })
    },
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === SUPPORT_ADDRESS_TYPE_NAME)
        .map(getChangeData)
        .forEach(inst => {
          inst.value.email = deployTemplateMapping[inst.elemID.getFullName()]
          extractProductionEmailFromEmail(inst)
        })
    },
  }
}

export default filterCreator
