/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  ReferenceExpression,
  ReadOnlyElementsSource,
  CORE_ANNOTATIONS,
  ElemID,
  isReferenceExpression,
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { ISSUE_LAYOUT_TYPE } from '../constants'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'
import { isRelevantMapping } from '../filters/layouts/issue_layout'

const log = logger(module)

type issueTypeMappingStruct = {
  issueTypeId: string | ReferenceExpression
  screenSchemeId: ReferenceExpression
}

const parentElemID = (instance: InstanceElement): ElemID | undefined =>
  instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.elemID

// Check if issueType in the issueTypeScheme of the project or default
const isIssueTypeDefaultOrInIssueTypeScheme = (
  issueTypeId: ReferenceExpression | string,
  projectIssueTypesFullName: string[],
): boolean =>
  isReferenceExpression(issueTypeId)
    ? projectIssueTypesFullName?.includes(issueTypeId?.elemID.getFullName())
    : issueTypeId === 'default'

// Do not filter issueLayouts that their parentElemID is undefined because the code after use them to push error
const getIssueLayoutsListByProject = (changes: ReadonlyArray<Change>): InstanceElement[][] =>
  Object.values(
    _.groupBy(
      changes
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === ISSUE_LAYOUT_TYPE),
      instance => parentElemID(instance)?.getFullName(),
    ),
  )

const getProjectIssueLayoutsScreensName = async (
  elementsSource: ReadOnlyElementsSource,
  projectElemID: ElemID | undefined,
): Promise<string[]> => {
  const project = projectElemID !== undefined ? await elementsSource.get(projectElemID) : undefined
  if (
    project?.value.issueTypeScheme === undefined ||
    project.value.issueTypeScreenScheme === undefined ||
    !isReferenceExpression(project.value.issueTypeScreenScheme) ||
    !isReferenceExpression(project.value.issueTypeScheme)
  ) {
    return []
  }
  const projectIssueTypesFullName = (
    (await elementsSource.get(project.value.issueTypeScheme.elemID))?.value.issueTypeIds ?? []
  )
    .filter(isReferenceExpression)
    .map((issueType: ReferenceExpression) => issueType.elemID.getFullName())

  const relevantIssueTypeMappings = (
    (await Promise.all(
      (await elementsSource.get(project.value.issueTypeScreenScheme.elemID))?.value.issueTypeMappings ?? [],
    )) as issueTypeMappingStruct[]
  ).filter(issueTypeMappingsElement =>
    isIssueTypeDefaultOrInIssueTypeScheme(issueTypeMappingsElement.issueTypeId, projectIssueTypesFullName),
  )

  return (
    await Promise.all(
      relevantIssueTypeMappings
        .filter(issueTypeMappingsElement =>
          isRelevantMapping(
            issueTypeMappingsElement.issueTypeId,
            relevantIssueTypeMappings.length,
            projectIssueTypesFullName.length,
          ),
        )
        .filter(issueTypeMappingsElement => isReferenceExpression(issueTypeMappingsElement.screenSchemeId))
        .map(async issueTypeMappingsElement => elementsSource.get(issueTypeMappingsElement.screenSchemeId.elemID)),
    )
  )
    .filter(isInstanceElement)
    .filter(
      screenScheme =>
        screenScheme.value.screens?.default !== undefined || screenScheme.value.screens?.view !== undefined,
    )
    .flatMap(screenScheme => screenScheme.value.screens.view ?? screenScheme.value.screens.default)
    .filter(isReferenceExpression)
    .map((screen: ReferenceExpression) => screen.elemID.getFullName())
}

type IssueLayoutErrorParams = {
  changes: ReadonlyArray<Change>
  elementsSource: ReadOnlyElementsSource
  issueErrorFor: 'valid' | 'invalid'
  message: string
  detailedMessageBuilder: (instance: InstanceElement) => string
}

const generateIssueLayoutErrors = async ({
  changes,
  elementsSource,
  issueErrorFor,
  message,
  detailedMessageBuilder,
}: IssueLayoutErrorParams): Promise<ChangeError[]> => {
  const errors: ChangeError[] = []
  // if we want to issue an error for invalid we should reverse the condition, for valid it remains the same
  const predicate = issueErrorFor === 'valid' ? (x: boolean) => x : (x: boolean) => !x
  await Promise.all(
    getIssueLayoutsListByProject(changes).map(async issueLayoutsByProject => {
      const screens = await getProjectIssueLayoutsScreensName(elementsSource, parentElemID(issueLayoutsByProject[0]))

      issueLayoutsByProject
        .filter(instance =>
          predicate(
            isReferenceExpression(instance.value.extraDefinerId) &&
              screens.includes(instance.value.extraDefinerId.elemID.getFullName()),
          ),
        )
        .forEach(instance => {
          errors.push({
            elemID: instance.elemID,
            severity: 'Error',
            message,
            detailedMessage: detailedMessageBuilder(instance),
          })
        })
    }),
  )
  return errors
}

// this change validator ensures the correctness of issue layout configurations within each project,
// by validating that each issue layout is linked to a valid screen according to his specific project
// we also check that the issue layout is linked to a relevant project
// for added or modified issue layouts an error is issued if the screen is not linked to the project
// for removed issue layouts an error is issued if the screen is linked to the project as you cannot delete an issue layout
export const issueLayoutsValidator: (client: JiraClient, config: JiraConfig) => ChangeValidator =
  (client, config) => async (changes, elementsSource) => {
    if (client.isDataCenter || !config.fetch.enableIssueLayouts || elementsSource === undefined) {
      log.info('Issue Layouts validation is disabled')
      return []
    }

    const addOrModifyErrors = await generateIssueLayoutErrors({
      changes: changes.filter(isAdditionOrModificationChange),
      elementsSource,
      issueErrorFor: 'invalid',
      message: 'Invalid screen for Issue Layout',
      detailedMessageBuilder: instance =>
        `This issue layout references a screen (${instance.value.extraDefinerId?.elemID?.getFullName()})` +
        ` that is not associated with its project (${parentElemID(instance)?.getFullName()}). Learn more at https://help.salto.io/en/articles/9306685-deploying-issue-layouts`,
    })
    return addOrModifyErrors.concat(
      await generateIssueLayoutErrors({
        changes: changes.filter(isRemovalChange),
        elementsSource,
        issueErrorFor: 'valid',
        message: 'Cannot delete Issue Layout',
        detailedMessageBuilder: instance =>
          `Issue Layouts cannot be deleted. To remove this issue layout delete its project (${parentElemID(instance)?.getFullName()}) or remove its screen (${instance.value.extraDefinerId.elemID.getFullName()}) association to the project`,
      }),
    )
  }
