/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import wu from 'wu'
import { logger } from '@salto-io/logging'
import { types, collections, values } from '@salto-io/lowerdash'
import {
  Element,
  isObjectType,
  isInstanceElement,
  TypeElement,
  InstanceElement,
  Field,
  PrimitiveTypes,
  Value,
  ElemID,
  CORE_ANNOTATIONS,
  SaltoElementError,
  SeverityLevel,
  isElement,
  isListType,
  getRestriction,
  isVariable,
  Variable,
  isPrimitiveValue,
  ListType,
  isReferenceExpression,
  StaticFile,
  isMapType,
  ObjectType,
  InstanceAnnotationTypes,
  GLOBAL_ADAPTER,
  SaltoError,
  ReadOnlyElementsSource,
  BuiltinTypes,
  isPlaceholderObjectType,
  CoreAnnotationTypes,
  isType,
  isField,
  isTemplateExpression,
  UnresolvedReference,
  MapType,
  RestrictionAnnotationType,
  PrimitiveType,
  TemplateExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { ERROR_MESSAGES, safeJsonStringify } from '@salto-io/adapter-utils'
import { parser } from '@salto-io/parser'
import { InvalidStaticFile } from './workspace/static_files/common'
import { CircularReference, resolve } from './expressions'
import { RemoteMapEntry } from './workspace/remote_map'

const log = logger(module)
const { makeArray } = collections.array

const MAX_VALUE_LENGTH = 25

type ValidationContext = {
  validatedReferences: Set<string>
  requiredFieldsByType: Map<string, Field[]>
  restrictedFieldsByType: Map<string, Field[]>
}

export abstract class ValidationError
  extends types.Bean<{
    elemID: ElemID
    error: string
    severity: SeverityLevel
  }>
  implements SaltoElementError
{
  message = ERROR_MESSAGES.INVALID_NACL_CONTENT

  get detailedMessage(): string {
    return this.error
  }

  toString(): string {
    return this.detailedMessage
  }
}

export const isValidationError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
): value is ValidationError => value instanceof ValidationError

const primitiveValidators: Record<PrimitiveTypes, (value: unknown) => boolean> = {
  [PrimitiveTypes.STRING]: value => typeof value === 'string',
  [PrimitiveTypes.NUMBER]: value => typeof value === 'number',
  [PrimitiveTypes.BOOLEAN]: value => typeof value === 'boolean',
  [PrimitiveTypes.UNKNOWN]: value => value !== undefined,
}

const lengthLimiterStringify = (value: Value, length = MAX_VALUE_LENGTH): string => {
  const safeValue = typeof value === 'string' ? value : safeJsonStringify(value)
  if (safeValue.length > length) {
    return `${safeValue.slice(0, length - 3)}...`
  }
  return safeValue
}

export class InvalidMetaTypeTypeValidationError extends ValidationError {
  readonly value: Value

  constructor({ elemID, value }: { elemID: ElemID; value: Value }) {
    const safeValue = lengthLimiterStringify(value)
    super({
      elemID,
      error: `Value ${safeValue} is not a valid meta type, most be an ObjectType.`,
      severity: 'Warning',
    })
    this.value = value
  }
}

export class InvalidMetaTypeMetaTypeValidationError extends ValidationError {
  readonly metaType: ObjectType

  constructor({ elemID, metaType }: { elemID: ElemID; metaType: ObjectType }) {
    super({
      elemID,
      error: `Meta type ${metaType.elemID.getFullName()} has a meta type defined (${metaType.metaType?.elemID?.getFullName() ?? '<missing>'}), must be undefined.`,
      severity: 'Warning',
    })
    this.metaType = metaType
  }
}

export class InvalidMetaTypeFieldsValidationError extends ValidationError {
  readonly metaType: ObjectType

  constructor({ elemID, metaType }: { elemID: ElemID; metaType: ObjectType }) {
    super({
      elemID,
      error: `Meta type ${metaType.elemID.getFullName()} has fields defined, must be empty.`,
      severity: 'Warning',
    })
    this.metaType = metaType
  }
}

export class InvalidValueValidationError extends ValidationError {
  readonly value: string
  readonly fieldName: string
  readonly expectedValue: unknown

  constructor({
    elemID,
    value,
    fieldName,
    expectedValue,
  }: {
    elemID: ElemID
    value: Value
    fieldName: string
    expectedValue: unknown
  }) {
    const expectedValueStr = Array.isArray(expectedValue)
      ? `one of: ${expectedValue.map(v => `"${v}"`).join(', ')}`
      : `"${expectedValue}"`
    const safeValue = lengthLimiterStringify(value)
    super({
      elemID,
      error: `Value "${safeValue}" is not valid for field ${fieldName} expected ${expectedValueStr}`,
      severity: 'Warning',
    })
    this.value = safeValue
    this.fieldName = fieldName
    this.expectedValue = expectedValue
  }
}

export class InvalidTypeValidationError extends ValidationError {
  constructor(readonly elemID: ElemID) {
    super({
      elemID,
      error: `Type ${elemID.typeName} of instance ${elemID.name} does not exist`,
      severity: 'Warning',
    })
  }
}

export class InvalidValueRangeValidationError extends ValidationError {
  readonly value: string
  readonly fieldName: string
  readonly minValue?: number
  readonly maxValue?: number

  static formatExpectedValue(minValue: number | undefined, maxValue: number | undefined): string {
    const minErrStr = minValue === undefined ? undefined : `bigger than ${minValue}`
    const maxErrStr = maxValue === undefined ? undefined : `smaller than ${maxValue}`
    return [minErrStr, maxErrStr].filter(values.isDefined).join(' and ')
  }

  constructor({
    elemID,
    value,
    fieldName,
    minValue,
    maxValue,
  }: {
    elemID: ElemID
    value: Value
    fieldName: string
    minValue?: number
    maxValue?: number
  }) {
    const safeValue = lengthLimiterStringify(value)
    super({
      elemID,
      error:
        `Value "${safeValue}" is not valid for field ${fieldName}` +
        ` expected to be ${InvalidValueRangeValidationError.formatExpectedValue(minValue, maxValue)}`,
      severity: 'Warning',
    })
    this.value = safeValue
    this.fieldName = fieldName
    this.minValue = minValue
    this.maxValue = maxValue
  }
}

export class RegexMismatchValidationError extends ValidationError {
  readonly value: string
  readonly fieldName: string
  readonly regex: string

  constructor({ elemID, value, fieldName, regex }: { elemID: ElemID; value: Value; fieldName: string; regex: string }) {
    const safeValue = lengthLimiterStringify(value)
    super({
      elemID,
      error:
        `Value "${safeValue}" is not valid for field ${fieldName}.` +
        ` expected value to match "${regex}" regular expression`,
      severity: 'Warning',
    })
    this.value = safeValue
    this.fieldName = fieldName
    this.regex = regex
  }
}

export class InvalidValueMaxLengthValidationError extends ValidationError {
  readonly value: string
  readonly fieldName: string
  readonly maxLength: number

  constructor({
    elemID,
    value,
    fieldName,
    maxLength,
  }: {
    elemID: ElemID
    value: string
    fieldName: string
    maxLength: number
  }) {
    const safeValue = lengthLimiterStringify(value)
    super({
      elemID,
      error: `Value "${safeValue}" is too long for field. ${fieldName} maximum length is ${maxLength}`,
      severity: 'Warning',
    })
    this.value = safeValue
    this.fieldName = fieldName
    this.maxLength = maxLength
  }
}

export class InvalidValueMaxListLengthValidationError extends ValidationError {
  readonly size: number
  readonly fieldName: string
  readonly maxListLength: number

  constructor({
    elemID,
    size,
    fieldName,
    maxListLength,
  }: {
    elemID: ElemID
    size: number
    fieldName: string
    maxListLength: number
  }) {
    super({
      elemID,
      error: `List of size ${size} is too large for field. ${fieldName} maximum length is ${maxListLength}`,
      severity: 'Warning',
    })
    this.size = size
    this.fieldName = fieldName
    this.maxListLength = maxListLength
  }
}

export class MissingRequiredFieldValidationError extends ValidationError {
  readonly fieldName: string

  constructor({ elemID, fieldName }: { elemID: ElemID; fieldName: string }) {
    super({
      elemID,
      error: `Field ${fieldName} is required but has no value`,
      severity: 'Warning',
    })
    this.fieldName = fieldName
  }
}

export class AdditionalPropertiesValidationError extends ValidationError {
  readonly fieldName: string
  readonly typeName: string

  constructor({ elemID, fieldName, typeName }: { elemID: ElemID; fieldName: string; typeName: string }) {
    super({
      elemID,
      error:
        `Field '${fieldName}' is not defined in the '${typeName}'` +
        ' type which does not allow additional properties.',
      severity: 'Warning',
    })
    this.fieldName = fieldName
    this.typeName = typeName
  }
}

export class UnresolvedReferenceValidationError extends ValidationError {
  readonly target: ElemID
  constructor({ elemID, target }: { elemID: ElemID; target: ElemID }) {
    super({
      elemID,
      error: `Unresolved reference ${target.getFullName()}`,
      severity: 'Warning',
    })
    this.target = target
  }

  message = ERROR_MESSAGES.UNRESOLVED_REFERENCE
}

export const isUnresolvedRefError = (err: SaltoError): err is UnresolvedReferenceValidationError =>
  err instanceof UnresolvedReferenceValidationError

export class IllegalReferenceValidationError extends ValidationError {
  readonly reason: string
  constructor({ elemID, reason }: { elemID: ElemID; reason: string }) {
    super({ elemID, error: `Illegal reference target, ${reason}`, severity: 'Warning' })
    this.reason = reason
  }
}

export class CircularReferenceValidationError extends ValidationError {
  readonly ref: string
  constructor({ elemID, ref }: { elemID: ElemID; ref: string }) {
    super({ elemID, error: `Circular reference ${ref}`, severity: 'Warning' })
    this.ref = ref
  }
}

export class InvalidStaticFileError extends ValidationError {
  constructor({ elemID, error }: { elemID: ElemID; error: string }) {
    super({
      elemID,
      error,
      severity: 'Error',
    })
  }
}

type RestrictionValidation = (
  restrictions: RestrictionAnnotationType,
  value: unknown,
  elemID: ElemID,
) => ValidationError[]

const validateValueInsideRange: RestrictionValidation = (restrictions, value, elemID) => {
  const minValue = restrictions.min
  const maxValue = restrictions.max
  if (
    (values.isDefined(minValue) && (typeof value !== 'number' || value < minValue)) ||
    (values.isDefined(maxValue) && (typeof value !== 'number' || value > maxValue))
  ) {
    return [
      new InvalidValueRangeValidationError({
        elemID,
        value,
        fieldName: elemID.name,
        minValue,
        maxValue,
      }),
    ]
  }
  return []
}

const validateValueInList: RestrictionValidation = (restrictions, value, elemID) => {
  const restrictionValues = makeArray(restrictions.values)
  if (restrictionValues.length === 0) {
    return []
  }
  if (!restrictionValues.some(i => _.isEqual(i, value))) {
    return [
      new InvalidValueValidationError({
        elemID,
        value,
        fieldName: elemID.name,
        expectedValue: restrictionValues,
      }),
    ]
  }
  return []
}

const validateRegexMatches: RestrictionValidation = (restrictions, value, elemID) => {
  if (restrictions.regex !== undefined && !new RegExp(restrictions.regex).test(String(value))) {
    return [
      new RegexMismatchValidationError({
        elemID,
        value,
        fieldName: elemID.name,
        regex: restrictions.regex,
      }),
    ]
  }
  return []
}

const validateMaxLengthLimit: RestrictionValidation = (restrictions, value, elemID) => {
  const maxLength = restrictions.max_length
  if (values.isDefined(maxLength) && typeof value === 'string' && value.length > maxLength) {
    return [
      new InvalidValueMaxLengthValidationError({
        elemID,
        value,
        fieldName: elemID.name,
        maxLength,
      }),
    ]
  }
  return []
}

const validateMaxListLengthLimit: RestrictionValidation = (restrictions, value, elemID) => {
  const maxListLength = restrictions.max_list_length
  if (values.isDefined(maxListLength) && Array.isArray(value) && value.length > maxListLength) {
    return [
      new InvalidValueMaxListLengthValidationError({
        elemID,
        size: value.length,
        fieldName: elemID.name,
        maxListLength,
      }),
    ]
  }
  return []
}

const restrictionValidations: RestrictionValidation[] = [
  validateValueInsideRange,
  validateValueInList,
  validateRegexMatches,
  validateMaxLengthLimit,
]

const shouldEnforceValue = (restrictions: RestrictionAnnotationType, value: unknown): boolean =>
  restrictions.enforce_value !== false && !(isReferenceExpression(value) && isElement(value.value))

const validateRestrictionsValue = (elemID: ElemID, value: Value, element: PrimitiveType | Field): ValidationError[] => {
  const restrictions = getRestriction(element)
  if (_.isEmpty(restrictions) || !shouldEnforceValue(restrictions, value)) {
    return []
  }

  // When value is array we iterate (validate) each element
  if (Array.isArray(value)) {
    return value
      .flatMap(v => validateRestrictionsValue(elemID, v, element))
      .concat(validateMaxListLengthLimit(restrictions, value, elemID))
  }

  return restrictionValidations.flatMap(validation => validation(restrictions, value, elemID))
}

export class InvalidValueTypeValidationError extends ValidationError {
  readonly type: ElemID
  constructor({ elemID, type }: { elemID: ElemID; value: Value; type: ElemID }) {
    super({
      elemID,
      error: `Invalid value type for ${type.getFullName()}`,
      severity: 'Warning',
    })
    this.type = type
  }
}

const createReferenceValidationErrors = (elemID: ElemID, value: Value): ValidationError[] => {
  if (value instanceof UnresolvedReference) {
    return [new UnresolvedReferenceValidationError({ elemID, target: value.target })]
  }
  if (value instanceof parser.IllegalReference) {
    return [new IllegalReferenceValidationError({ elemID, reason: value.message })]
  }
  if (value instanceof CircularReference) {
    return [new CircularReferenceValidationError({ elemID, ref: value.ref })]
  }
  return []
}

const validateNoAdditionalProperties = (
  elemID: ElemID,
  value: Value,
  type: ObjectType | MapType,
): ValidationError[] => {
  if (isObjectType(type) && type.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] === false) {
    return Object.keys(value)
      .filter(key => !Object.prototype.hasOwnProperty.call(type.fields, key))
      .map(
        key =>
          new AdditionalPropertiesValidationError({
            elemID,
            fieldName: key,
            typeName: type.elemID.typeName,
          }),
      )
  }
  return []
}

const validatePrimitiveValueType = (elemID: ElemID, value: Value, type: PrimitiveType): ValidationError[] => {
  if (!primitiveValidators[type.primitive](value)) {
    return [
      new InvalidValueTypeValidationError({
        elemID,
        value,
        type: type.elemID,
      }),
    ]
  }
  return []
}

const isEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length === 0

const getRequiredFields = (type: ObjectType, context: ValidationContext): Field[] => {
  const typeId = type.elemID.getFullName()
  const requiredFields = context.requiredFieldsByType.get(typeId)
  if (requiredFields !== undefined) {
    return requiredFields
  }
  const calculatedRequiredFields = Object.values(type.fields).filter(
    field => field.annotations[CORE_ANNOTATIONS.REQUIRED] === true,
  )
  context.requiredFieldsByType.set(typeId, calculatedRequiredFields)
  return calculatedRequiredFields
}

const validateRequiredFields = (
  elemID: ElemID,
  value: Value,
  type: TypeElement,
  context: ValidationContext,
): ValidationError[] => {
  if (!isObjectType(type) || elemID.idType !== 'instance') {
    return []
  }
  return getRequiredFields(type, context)
    .filter(
      field => value[field.name] === undefined || (isEmptyArray(value[field.name]) && !isListType(field.refType.type)),
    )
    .map(
      field =>
        new MissingRequiredFieldValidationError({
          elemID: value[field.name] !== undefined ? elemID.createNestedID(field.name) : elemID,
          fieldName: field.name,
        }),
    )
}

const getRestrictedFields = (type: ObjectType, context: ValidationContext): Field[] => {
  const typeId = type.elemID.getFullName()
  const restrictedFields = context.restrictedFieldsByType.get(typeId)
  if (restrictedFields !== undefined) {
    return restrictedFields
  }
  const calculatedRestrictedFields = Object.values(type.fields).filter(field => !_.isEmpty(getRestriction(field)))
  context.restrictedFieldsByType.set(typeId, calculatedRestrictedFields)
  return calculatedRestrictedFields
}

const validateRestrictedFields = (
  elemID: ElemID,
  value: Value,
  type: TypeElement,
  context: ValidationContext,
): ValidationError[] => {
  if (!isObjectType(type) || elemID.idType !== 'instance') {
    return []
  }
  return getRestrictedFields(type, context)
    .filter(field => value[field.name] !== undefined)
    .flatMap(field => validateRestrictionsValue(elemID.createNestedID(field.name), value[field.name], field))
}

const validateReferenceExpression = (
  elemID: ElemID,
  value: ReferenceExpression,
  type: TypeElement,
  context: ValidationContext,
): ValidationError[] => {
  const { validatedReferences } = context
  if (!isElement(value.value) && !validatedReferences.has(value.elemID.getFullName())) {
    validatedReferences.add(value.elemID.getFullName())
    // eslint-disable-next-line no-use-before-define
    const result = validateValue(elemID, value.value, type, context)
    validatedReferences.delete(value.elemID.getFullName())
    return result
  }
  return []
}

const validateTemplateExpression = (
  elemID: ElemID,
  value: TemplateExpression,
  type: TypeElement,
  context: ValidationContext,
): ValidationError[] => {
  const templatedReferenceValidationErrors = value.parts.flatMap(part =>
    isReferenceExpression(part) ? createReferenceValidationErrors(elemID, part.value) : [],
  )
  // eslint-disable-next-line no-use-before-define
  return templatedReferenceValidationErrors.concat(validateValue(elemID, value.value, type, context))
}

const validateObjectValue = (
  elemID: ElemID,
  value: Value,
  type: ObjectType | MapType,
  context: ValidationContext,
): ValidationError[] => {
  if (!_.isObjectLike(value)) {
    // TODO: we shouldn't validate required fields for non-object values
    return validateRequiredFields(elemID, value, type, context).concat(
      new InvalidValueTypeValidationError({
        elemID,
        value,
        type: type.elemID,
      }),
    )
  }

  const missingRequiredFieldsErrors = validateRequiredFields(elemID, value, type, context)
  const additionalPropertiesErrors = validateNoAdditionalProperties(elemID, value, type)
  const restrictedFieldsErrors = validateRestrictedFields(elemID, value, type, context)

  const fieldValidationErrors = Object.keys(value).flatMap(k =>
    // eslint-disable-next-line no-use-before-define
    validateValue(
      elemID.createNestedID(k),
      value[k],
      (isObjectType(type) ? type.fields[k]?.refType.type : type.refInnerType.type) ?? BuiltinTypes.UNKNOWN,
      context,
    ),
  )

  return missingRequiredFieldsErrors
    .concat(additionalPropertiesErrors)
    .concat(fieldValidationErrors)
    .concat(restrictedFieldsErrors)
}

const validateUnknownValue = (elemID: ElemID, value: Value, context: ValidationContext): ValidationError[] => {
  if (!_.isObjectLike(value)) {
    return []
  }
  return Object.keys(value).flatMap(k =>
    // eslint-disable-next-line no-use-before-define
    validateValue(elemID.createNestedID(k), value[k], BuiltinTypes.UNKNOWN, context),
  )
}

const validateListItems = (
  elemID: ElemID,
  value: Value[],
  innerType: TypeElement,
  context: ValidationContext,
): ValidationError[] =>
  // eslint-disable-next-line no-use-before-define
  value.flatMap((val, i) => validateValue(elemID.createNestedID(String(i)), val, innerType, context))

const validateListValue = (
  elemID: ElemID,
  value: Value,
  type: ListType,
  context: ValidationContext,
): ValidationError[] => {
  const innerType = type.refInnerType.type
  if (!isType(innerType)) {
    // Should never happen because we resolve the element before calling this
    log.error(
      'Found unresolved type at %s, type=%s innerType=%o',
      elemID.getFullName(),
      type.elemID.getFullName(),
      innerType,
    )
    return []
  }
  return Array.isArray(value)
    ? validateListItems(elemID, value, innerType, context)
    : // eslint-disable-next-line no-use-before-define
      validateValue(elemID, value, innerType, context)
}

const validatePrimitiveValue = (elemID: ElemID, value: Value, type: PrimitiveType): ValidationError[] => {
  const invalidValueTypeErrors = validatePrimitiveValueType(elemID, value, type)
  const restrictionErrors = validateRestrictionsValue(elemID, value, type)

  return invalidValueTypeErrors.concat(restrictionErrors)
}

const validateValue = (
  elemID: ElemID,
  value: Value,
  type: TypeElement,
  context: ValidationContext,
): ValidationError[] => {
  if (Array.isArray(value) && !isListType(type)) {
    return validateListItems(elemID, value, type, context)
  }

  if (isReferenceExpression(value)) {
    return validateReferenceExpression(elemID, value, type, context)
  }

  if (isTemplateExpression(value)) {
    return validateTemplateExpression(elemID, value, type, context)
  }

  const referenceValidationErrors = createReferenceValidationErrors(elemID, value)
  if (referenceValidationErrors.length > 0) {
    return referenceValidationErrors
  }

  if (value instanceof InvalidStaticFile) {
    return [new InvalidStaticFileError({ elemID, error: value.message })]
  }

  if (value instanceof StaticFile) {
    return []
  }

  if (isVariable(value)) {
    return [
      new InvalidValueValidationError({
        elemID,
        value,
        fieldName: elemID.name,
        expectedValue: 'not a variable',
      }),
    ]
  }

  if (isObjectType(type) || isMapType(type)) {
    return validateObjectValue(elemID, value, type, context)
  }

  if (type === BuiltinTypes.UNKNOWN) {
    return validateUnknownValue(elemID, value, context)
  }

  if (isListType(type)) {
    return validateListValue(elemID, value, type, context)
  }

  // type-wise, we can only get here if type is a primitive type
  return validatePrimitiveValue(elemID, value, type)
}

const syncGetElementAnnotationTypes = (element: TypeElement | Field): Record<string, TypeElement> => {
  // We assume all elements are resolved, so if we access a field's refType, it will be there
  let type: TypeElement | undefined
  if (isField(element)) {
    type = element.refType.type
  } else if (isObjectType(element)) {
    type = element.metaType?.type ?? element
  } else {
    type = element
  }

  return {
    ...CoreAnnotationTypes,
    ...InstanceAnnotationTypes,
    ..._.pickBy(
      _.mapValues(type?.annotationRefTypes, ref => ref.type),
      // We assume all elements are resolved, and therefore we know the types are defined and this
      // filter won't actually omit anything
      values.isDefined,
    ),
  }
}

const validateField = (field: Field, context: ValidationContext): ValidationError[] => {
  const annotationTypes = syncGetElementAnnotationTypes(field)
  return Object.keys(field.annotations)
    .filter(k => annotationTypes[k] !== undefined)
    .flatMap(k => validateValue(field.elemID.createNestedID(k), field.annotations[k], annotationTypes[k], context))
}

const validateMetaType = (element: ObjectType): ValidationError[] => {
  if (element.metaType === undefined) {
    return []
  }

  const { elemID } = element
  const metaType = element.metaType.type
  if (metaType === undefined) {
    // Should never happen because we resolve the element before calling this
    log.error(`Found unresolved meta type for ${elemID.getFullName()}.`)
    return []
  }

  if (!isObjectType(metaType)) {
    return [new InvalidMetaTypeTypeValidationError({ elemID, value: metaType })]
  }

  const errors = []
  if (metaType.metaType !== undefined) {
    errors.push(new InvalidMetaTypeMetaTypeValidationError({ elemID, metaType }))
  }

  if (Object.keys(metaType.fields).length > 0) {
    errors.push(new InvalidMetaTypeFieldsValidationError({ elemID, metaType }))
  }

  return errors
}

const validateType = (element: TypeElement, context: ValidationContext): ValidationError[] => {
  const annotationTypes = syncGetElementAnnotationTypes(element)
  const errors = Object.keys(element.annotations)
    .filter(k => annotationTypes[k] !== undefined)
    .flatMap(k =>
      validateValue(element.elemID.createNestedID('attr', k), element.annotations[k], annotationTypes[k], context),
    )
  if (isObjectType(element)) {
    const metaTypeErrors = validateMetaType(element)
    const fieldErrors = Object.values(element.fields).flatMap(elem => validateField(elem, context))
    return errors.concat(metaTypeErrors).concat(fieldErrors)
  }
  return errors
}

const instanceAnnotationsType = new ObjectType({
  elemID: new ElemID(GLOBAL_ADAPTER, 'instanceAnnotations'), // dummy elemID, it's not really used
  fields: Object.fromEntries(Object.entries(InstanceAnnotationTypes).map(([name, type]) => [name, { refType: type }])),
})
const validateInstanceType = (elemID: ElemID, type: ObjectType): ValidationError[] => {
  if (isPlaceholderObjectType(type)) {
    return [new InvalidTypeValidationError(elemID)]
  }
  return []
}

const validateInstanceElement = (element: InstanceElement, context: ValidationContext): ValidationError[] => {
  const instanceType = element.refType.type
  if (!isObjectType(instanceType)) {
    // Should never happen because we resolve the element before calling this
    log.error('Found unresolved type at %s, instanceType=%o', element.elemID.getFullName(), instanceType)
    return []
  }
  return validateValue(element.elemID, element.value, instanceType, context)
    .concat(validateValue(element.elemID, element.annotations, instanceAnnotationsType, context))
    .concat(validateInstanceType(element.elemID, instanceType))
}

const validateVariableValue = (elemID: ElemID, value: Value): ValidationError[] => {
  if (isReferenceExpression(value)) {
    return validateVariableValue(elemID, value.value)
  }
  const referenceValidationErrors = createReferenceValidationErrors(elemID, value)
  if (referenceValidationErrors.length > 0) {
    return referenceValidationErrors
  }

  if (!isPrimitiveValue(value)) {
    return [
      new InvalidValueValidationError({
        elemID,
        value,
        fieldName: elemID.name,
        expectedValue: 'a primitive or a reference to a primitive',
      }),
    ]
  }
  return []
}

const validateVariable = (element: Variable): ValidationError[] => validateVariableValue(element.elemID, element.value)

const createContext = (): ValidationContext => ({
  validatedReferences: new Set<string>(),
  requiredFieldsByType: new Map<string, Field[]>(),
  restrictedFieldsByType: new Map<string, Field[]>(),
})

export const validateElement = (element: Element, context: ValidationContext = createContext()): ValidationError[] =>
  log.timeTrace(
    () => {
      if (isInstanceElement(element)) {
        return validateInstanceElement(element, context)
      }
      if (isVariable(element)) {
        return validateVariable(element)
      }
      if (isType(element)) {
        return validateType(element, context)
      }
      return []
    },
    'validateElement %s',
    element.elemID.getFullName(),
  )

export const validateElements = async (
  elements: Element[],
  elementsSource: ReadOnlyElementsSource,
): Promise<Iterable<RemoteMapEntry<ValidationError[]>>> => {
  const resolved = await resolve(elements, elementsSource)
  const groupedByTopLevelId = _.groupBy(resolved, elem => elem.elemID.createTopLevelParentID().parent.getFullName())

  const context = createContext()

  return log.timeIteratorDebug(
    wu(Object.entries(groupedByTopLevelId))
      .map(([key, elems]) => ({
        key,
        value: elems.flatMap(element => validateElement(element, context)),
      }))
      .filter(errors => errors.value.length > 0),
    'validateElements with %d elements',
    elements.length,
  )
}
