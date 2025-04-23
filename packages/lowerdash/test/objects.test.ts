/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { cleanEmptyObjects, concatObjects, getOwn } from '../src/objects'

describe('concatObjects', () => {
  type testType = {
    a: string[] | undefined
    b: string[] | undefined
    c: { name: string }[] | undefined
  }
  const objects: testType[] = [
    {
      a: ['a', 'b'],
      b: ['1', '2'],
      c: undefined,
    },
    {
      a: ['c', 'd'],
      b: undefined,
      c: [{ name: 'name1' }, { name: 'name2' }],
    },
    {
      a: undefined,
      b: ['3', '4'],
      c: [{ name: 'name1' }, { name: 'name4' }],
    },
  ]

  describe('when uniqueFnByKey is not provided', () => {
    it('Should return an object with duplicate array values concatenated', () => {
      expect(concatObjects(objects)).toEqual({
        a: ['a', 'b', 'c', 'd'],
        b: ['1', '2', '3', '4'],
        c: [{ name: 'name1' }, { name: 'name2' }, { name: 'name1' }, { name: 'name4' }],
      })
    })
  })
  describe('when uniqueFnByKey is provided', () => {
    it('Should return an object with unique array values concatenated', () => {
      expect(concatObjects(objects, { c: values => _.uniqBy(values, 'name') })).toEqual({
        a: ['a', 'b', 'c', 'd'],
        b: ['1', '2', '3', '4'],
        c: [{ name: 'name1' }, { name: 'name2' }, { name: 'name4' }],
      })
    })
  })
})

describe('cleanEmptyObjects', () => {
  it('should not return undefined for empty arrays', () => {
    expect(cleanEmptyObjects({ a: [] })).toEqual({ a: [] })
  })
  it('should return undefined for empty object', () => {
    const obj = { a: {} }
    expect(cleanEmptyObjects(obj)).toBeUndefined()
  })
  it('should remove object parts', () => {
    const obj = {
      a: 'a',
      b: {},
      c: {
        d: 'd',
        e: {
          f: {},
          g: { h: undefined },
        },
      },
    }
    expect(cleanEmptyObjects(obj)).toEqual({
      a: 'a',
      c: {
        d: 'd',
      },
    })
  })
  it('should not clean arrays or objects inside arrays', () => {
    const obj = {
      a: 'a',
      b: {
        c: {},
        arr: [],
      },
      anotherArr: [{}, { a: 'b' }],
    }
    expect(cleanEmptyObjects(obj)).toEqual({
      a: 'a',
      b: {
        arr: [],
      },
      anotherArr: [{}, { a: 'b' }],
    })
  })
})

describe('getOwn', () => {
  const obj = {
    a: {
      b: {
        c: 'value',
      },
      arr: [1, 2, 3],
    },
    top: 'val',
    toString: 'obj',
  }

  // Create an object with inherited properties
  const proto = { inherited: 'value' }
  const objWithInherited = Object.create(proto)
  objWithInherited.own = 'value'

  // Create an object with null prototype
  const nullProtoObj = Object.create(null)
  nullProtoObj.test = 'value'

  it('should get nested own properties', () => {
    expect(getOwn(obj, ['a', 'b', 'c'])).toBe('value')
  })

  it('should support single string path', () => {
    expect(getOwn(obj, 'top')).toBe('val')
  })

  it('should work with array indices', () => {
    expect(getOwn(obj, ['a', 'arr', '1'])).toBe(2)
  })

  it('should return defaultValue for non-existent paths', () => {
    expect(getOwn(obj, ['a', 'x', 'y'], 'default')).toBe('default')
  })

  it('should return defaultValue for non-object intermediate values', () => {
    expect(getOwn(obj, ['a', 'b', 'c', 'deeper'], 'default')).toBe('default')
  })

  it('should ignore properties from Object prototype', () => {
    expect(getOwn(obj, ['constructor'], 'default')).toBe('default')
  })

  it('should get own properties which override Object prototype properties', () => {
    expect(getOwn(obj, ['toString'], 'default')).toBe('obj')
  })

  it('should ignore inherited properties', () => {
    expect(getOwn(objWithInherited, ['inherited'], 'default')).toBe('default')
    expect(getOwn(objWithInherited, ['own'])).toBe('value')
  })

  it('should work with objects with null prototype', () => {
    expect(getOwn(nullProtoObj, ['test'])).toBe('value')
  })

  it('should handle null/undefined input object', () => {
    expect(getOwn(null, ['a'], 'default')).toBe('default')
    expect(getOwn(undefined, ['a'], 'default')).toBe('default')
  })

  it('should return undefined when no defaultValue is provided', () => {
    expect(getOwn(obj, ['nonexistent'])).toBeUndefined()
  })
})
