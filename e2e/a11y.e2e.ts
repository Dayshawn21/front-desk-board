import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { signInAsPatient } from './patientSignIn.js'

// Automated accessibility checks (axe-core) on each main screen, in a real
// browser so colour contrast and layout are measured. axe finds roughly a
// third of WCAG issues; keyboard and screen-reader behaviour is covered by
// the other tests and by hand.

// WCAG 2.2 A/AA rules plus axe's best practices (which include using only
// ARIA roles that HTML allows on each element; Lighthouse found that one).
const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
]

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .analyze()
  // One line per problem, so a failure says what and where.
  const summary = violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} (${v.help})`),
  )
  expect(summary).toEqual([])
}

async function signInAsFrontDesk(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /rosa jimenez/i }).click()
  await expect(page.getByRole('button', { name: /^Jon Kim,/ })).toBeVisible()
}

test('sign-in page', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: /rosa jimenez/i }),
  ).toBeVisible()
  await expectNoViolations(page)
})

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsFrontDesk(page)
  })

  test('schedule board', async ({ page }) => {
    await expectNoViolations(page)
  })

  test('patient flow', async ({ page }) => {
    await page.getByRole('tab', { name: 'Patient flow' }).click()
    await expect(
      page.getByRole('tab', { name: 'Patient flow', selected: true }),
    ).toBeVisible()
    await expectNoViolations(page)
  })

  test('check-in drawer', async ({ page }) => {
    await page.getByRole('button', { name: /^Lena Ortiz,/ }).click()
    await expect(page.getByRole('dialog', { name: /Lena Ortiz/ })).toBeVisible()
    await expectNoViolations(page)
  })

  test('new appointment panel', async ({ page }) => {
    await page.getByRole('button', { name: 'New appointment' }).click()
    const booking = page.getByRole('dialog', { name: 'New appointment' })
    await booking.getByLabel('Patient', { exact: true }).selectOption('p-ana')
    await expect(booking.getByRole('radio').first()).toBeVisible()
    await expectNoViolations(page)
  })

  test('account menu', async ({ page }) => {
    await page.getByRole('button', { name: /account menu/i }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expectNoViolations(page)
  })

  test('toast after booking', async ({ page }) => {
    await page.getByRole('button', { name: 'New appointment' }).click()
    const booking = page.getByRole('dialog', { name: 'New appointment' })
    await booking.getByLabel('Patient', { exact: true }).selectOption('p-ana')
    await booking.getByRole('radio').first().check()
    await booking.getByRole('button', { name: 'Book', exact: true }).click()
    await expect(page.getByText(/^Booked Ana Diaz/)).toBeVisible()
    await expectNoViolations(page)
  })

  test('schedule board on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await expectNoViolations(page)
  })
})

test('error screen (board crashed on purpose with ?crash)', async ({
  page,
}) => {
  const logged: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') logged.push(msg.text())
  })
  await page.goto('/?crash')
  await page.getByRole('button', { name: /rosa jimenez/i }).click()

  const heading = page.getByRole('heading', { name: 'Something went wrong' })
  await expect(heading).toBeFocused()
  expect(logged.some((line) => line.includes('[front-desk-board] error'))).toBe(
    true,
  )
  await expectNoViolations(page)
})

test.describe('signed in, cancel and no-show', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsFrontDesk(page)
  })

  test('cancel reason step', async ({ page }) => {
    await page.getByRole('button', { name: /^Owen Hart,/ }).click()
    const drawer = page.getByRole('dialog', { name: 'Owen Hart' })
    await drawer.getByRole('button', { name: 'Cancel visit…' }).click()
    // Submit without a reason, so the error is on screen too.
    await drawer
      .getByRole('button', { name: 'Cancel visit', exact: true })
      .click()
    await expect(drawer.getByText('Choose a reason.')).toBeVisible()
    await expectNoViolations(page)
  })

  test('schedule with a no-show', async ({ page }) => {
    await page.getByRole('button', { name: /^Priya Shah,/ }).click()
    await page.getByRole('button', { name: 'Mark no-show' }).click()
    await expect(page.getByText('Priya Shah: marked no-show')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: /^Priya Shah, No-show,/ }),
    ).toBeVisible()
    await expectNoViolations(page)
  })
})

test('the theme follows the device until a choice is made', async ({
  page,
}, testInfo) => {
  await signInAsFrontDesk(page)
  const isDark = async () =>
    /\bdark\b/.test((await page.locator('html').getAttribute('class')) ?? '')
  // The chromium-dark project sets the device to dark.
  const deviceIsDark = testInfo.project.name === 'chromium-dark'
  expect(await isDark()).toBe(deviceIsDark)

  // Choose the other one; it sticks after a reload.
  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByText(deviceIsDark ? 'Light' : 'Dark', { exact: true }).click()
  await expect.poll(isDark).toBe(!deviceIsDark)
  await expectNoViolations(page)
  await page.reload()
  await expect.poll(isDark).toBe(!deviceIsDark)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('schedule, one chair at a time', async ({ page }) => {
    // Not signInAsFrontDesk: it waits for Jon Kim, who is in Chair 2.
    await page.goto('/')
    await page.getByRole('button', { name: /rosa jimenez/i }).click()
    await expect(page.getByRole('button', { name: /^Ana Diaz,/ })).toBeVisible()
    await page
      .getByRole('group', { name: 'Chair' })
      .getByText('Chair 2', { exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: /^Lena Ortiz,/ }),
    ).toBeVisible()
    await expectNoViolations(page)
  })

  test('patient flow, one column at a time', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /rosa jimenez/i }).click()
    await page.getByRole('tab', { name: 'Patient flow' }).click()
    await expect(page.getByRole('region', { name: /^Arrived/ })).toBeVisible()
    await expectNoViolations(page)
  })
})

// The patient's pages: public, phone-first. Checked at desktop and phone
// width, in light and (in the chromium-dark project) dark.
async function bookCheckup(page: Page) {
  await page.goto('/book/maple')
  await signInAsPatient(page, 'grace.liu@example.com')
  await page.getByRole('radio', { name: /^Checkup/ }).check()
  // Click the visible label: the radio itself is visually hidden.
  await page
    .getByRole('group', { name: 'Pick a time' })
    .getByText('11:30 AM', { exact: true })
    .click()
}

async function expectNoSideways(page: Page) {
  // A string runs in the page (the e2e tsconfig has no DOM types).
  const overflow = await page.evaluate<number>(
    'document.documentElement.scrollWidth - window.innerWidth',
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('patient pages', () => {
  test('book a visit, with times showing', async ({ page }) => {
    await bookCheckup(page)
    await expectNoViolations(page)
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('book a visit, with times showing', async ({ page }) => {
      await bookCheckup(page)
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('booking confirmed', async ({ page }) => {
      await bookCheckup(page)
      await page.getByRole('button', { name: 'Book 11:30 AM' }).click()
      await expect(
        page.getByRole('heading', { name: "You're booked" }),
      ).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('check in from a phone', async ({ page }) => {
      await page.goto('/check-in/maple/a-11')
      await signInAsPatient(page, 'ravi.menon@example.com')
      await page
        .getByRole('checkbox', { name: "I've filled in my visit forms" })
        .check()
      await expect(page.getByText('Saved')).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('checked in', async ({ page }) => {
      await page.goto('/check-in/maple/a-11')
      await signInAsPatient(page, 'ravi.menon@example.com')
      await page.getByRole('button', { name: "I'm here" }).click()
      await expect(
        page.getByRole('heading', { name: "You're checked in" }),
      ).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('choose a practice', async ({ page }) => {
      await page.goto('/book')
      await expect(
        page.getByRole('heading', { name: 'Choose your dental office' }),
      ).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('patient sign-in', async ({ page }) => {
      await page.goto('/patient')
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('change password, with an error', async ({ page }) => {
      await page.goto('/patient/change-password')
      await signInAsPatient(page, 'owen.hart@example.com')
      await page.getByLabel('Current password').fill('not my password')
      await page.getByLabel('New password').fill('brand new pass')
      await page.getByLabel('Type it again').fill('brand new pass')
      await page.getByRole('button', { name: 'Change password' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('forgot password, link sent', async ({ page }) => {
      await page.goto('/patient/forgot-password')
      await page.getByLabel('Email').fill('owen.hart@example.com')
      await page.getByRole('button', { name: 'Send reset link' }).click()
      await expect(
        page.getByRole('heading', { name: 'Check your email' }),
      ).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('demo inbox and new password', async ({ page }) => {
      await page.goto('/patient/forgot-password')
      await page.getByLabel('Email').fill('owen.hart@example.com')
      await page.getByRole('button', { name: 'Send reset link' }).click()
      await page.getByRole('link', { name: /demo inbox/i }).click()
      await expect(page.getByRole('article')).toHaveCount(1)
      await expectNoSideways(page)
      await expectNoViolations(page)

      await page.getByRole('link', { name: 'Reset your password' }).click()
      await page.getByLabel('New password').fill('brand new pass')
      await page.getByLabel('Type it again').fill('not the same')
      await page.getByRole('button', { name: 'Change password' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('patient sign-up', async ({ page }) => {
      await page.goto('/patient/sign-up')
      await expect(
        page.getByRole('heading', { name: 'Create your account' }),
      ).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('patient sign-up with an email already in use', async ({ page }) => {
      await page.goto('/patient/sign-up')
      await page.getByText('Maple Street Dental').click()
      await page.getByLabel('First name').fill('Zoe')
      await page.getByLabel('Last name').fill('Quill')
      await page.getByLabel('Phone').fill('555-0199')
      await page.getByLabel('Email').fill('owen.hart@example.com')
      await page.getByLabel('Password').fill('correct horse')
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expectNoViolations(page)
    })

    test('patient sign-in with a wrong password', async ({ page }) => {
      await page.goto('/patient')
      await page.getByLabel('Email').fill('owen.hart@example.com')
      await page.getByLabel('Password').fill('wrong-password')
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expectNoViolations(page)
    })

    test('your visits', async ({ page }) => {
      await page.goto('/patient')
      await signInAsPatient(page, 'owen.hart@example.com')
      await expect(
        page.getByRole('heading', { name: 'Your visits' }),
      ).toBeVisible()
      await expectNoSideways(page)
      await expectNoViolations(page)
    })

    test('a practice that does not exist', async ({ page }) => {
      await page.goto('/book/nowhere')
      await expect(
        page.getByRole('heading', { name: "We couldn't find that practice" }),
      ).toBeVisible()
      await expectNoViolations(page)
    })
  })
})
