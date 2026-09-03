import { expect, test } from '@playwright/test';

test('shows audited dog access for attractions and food', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByText('Change town').click();
  await page.getByLabel('Search towns').fill('Kirriemuir');
  await page.getByLabel('Town', { exact: true }).selectOption('kirriemuir-scotland');

  const tripPlanner = page.getByLabel('Town trip planner');
  const birthplace = tripPlanner.getByRole('button').filter({
    hasText: "J M Barrie's Birthplace",
  });
  const cameraObscura = tripPlanner.getByRole('button').filter({
    hasText: 'Kirriemuir Camera Obscura',
  });

  await expect(birthplace.locator('.dog-paw-badge')).toHaveAttribute(
    'title',
    '0 paws out of 3: Dog policy not confirmed',
  );
  await expect(cameraObscura.locator('.dog-paw-badge')).toHaveAttribute(
    'title',
    '1 paw out of 3: Limited dog access',
  );
  await expect(cameraObscura.locator('.dog-paw-scale')).toHaveText('🐾');

  await birthplace.click();
  await expect(page.getByRole('heading', { name: 'Visiting with a dog' })).toBeVisible();
  await expect(page.locator('.dog-access-section')).toContainText('0/3');
  await expect(page.locator('.dog-access-section')).toContainText('Dog policy not confirmed');
  await page.getByRole('button', { name: 'Back to list' }).click();

  await tripPlanner.getByRole('tab', { name: /Eat/ }).click();
  const gardenCafe = tripPlanner.getByRole('button').filter({
    hasText: 'The Garden Cafe at Pathhead Farm',
  });
  await expect(gardenCafe.locator('.dog-paw-badge')).toHaveAttribute(
    'title',
    '2 paws out of 3: Dog friendly',
  );

  await gardenCafe.click();
  await expect(page.getByRole('heading', { name: 'Visiting with a dog' })).toBeVisible();
  await expect(page.locator('.dog-access-section')).toContainText('2/3');
  await expect(page.locator('.dog-access-section')).toContainText('Dog friendly');
});
