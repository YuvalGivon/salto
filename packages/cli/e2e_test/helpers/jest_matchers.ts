/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import type { Plan } from '@salto-io/core'
import { formatExecutionPlan } from '../../src/formatter'

expect.extend({
  toBeEmptyPlan(plan?: Plan) {
    const createMessage = (expected: string): string =>
      [
        this.utils.matcherHint('toBeEmptyPlan', undefined, ''),
        '',
        `Expected: ${this.utils.printExpected(expected)}`,
        `Received: ${this.utils.printReceived(plan ? formatExecutionPlan(plan, [], true) : 'undefined')}`,
      ].join('\n')

    if (plan?.size === 0 && plan?.changeErrors.length === 0) {
      return {
        message: () => createMessage('non empty plan'),
        pass: true,
      }
    }

    return {
      message: () => createMessage('empty plan'),
      pass: false,
    }
  },
})

interface CustomMatchers<R = unknown> {
  toBeEmptyPlan(): R
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Expect extends CustomMatchers {}
    interface Matchers<R> extends CustomMatchers<R> {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}
