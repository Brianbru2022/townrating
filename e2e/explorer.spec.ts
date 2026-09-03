import { expect, test } from '@playwright/test';

interface TestHomeMap {
  getStyle(): { sources: Record<string, { tiles?: string[] }> };
  jumpTo(options: { center: [number, number]; zoom: number }): void;
  project(coordinates: [number, number]): { x: number; y: number };
}

interface TestExploreMap {
  getStyle(): { sources: Record<string, { tiles?: string[] }> };
  querySourceFeatures(id: string): Array<{
    properties?: { id?: string; markerCategory?: string; markerIcon?: string; name?: string };
  }>;
  project(coordinates: { lng: number; lat: number }): { x: number; y: number };
  getLayoutProperty(layerId: string, name: string): unknown;
}

test('keeps Home town labels anchored and filters every discovery mode by rating range', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.home-map[data-ready="true"]')).toBeVisible({ timeout: 15_000 });

  const townRange = page.getByRole('group', { name: 'Town rating range' });
  await expect(townRange.getByLabel('Minimum town rating')).toHaveValue('1');
  await expect(townRange.getByLabel('Maximum town rating')).toHaveValue('3');
  await expect(townRange).toContainText('1 to 3 stars');

  const mountedTownLabels = page.locator('.home-town-label');
  await expect(mountedTownLabels.first()).toBeVisible();
  expect(await mountedTownLabels.count()).toBeLessThan(150);
  expect(await page.locator('.home-town-label.hidden').count()).toBe(0);

  await page.locator('.home-map').evaluate((element) => {
    const map = (element as HTMLDivElement & { __homeMap?: TestHomeMap }).__homeMap;
    map?.jumpTo({ center: [-0.2404, 52.5726], zoom: 8 });
  });
  const peterboroughLabel = page.locator(
    '.home-town-label[data-project-id="peterborough-england"]',
  );
  await expect(peterboroughLabel).toBeAttached();
  await expect(peterboroughLabel).toHaveCSS('position', 'absolute');
  expect(
    await peterboroughLabel.evaluate((label) => {
      const anchor = getComputedStyle(label, '::after');
      return {
        background: anchor.backgroundColor,
        borderRadius: anchor.borderRadius,
        height: anchor.height,
        width: anchor.width,
      };
    }),
  ).toEqual({
    background: 'rgb(17, 28, 30)',
    borderRadius: '50%',
    height: '9px',
    width: '9px',
  });
  await expect
    .poll(() =>
      peterboroughLabel.evaluate((label) => {
        const mapElement = document.querySelector('.home-map') as
          | (HTMLDivElement & { __homeMap?: TestHomeMap })
          | null;
        const map = mapElement?.__homeMap;
        if (!map || !mapElement) return Number.POSITIVE_INFINITY;
        const longitude = Number((label as HTMLElement).dataset.longitude);
        const latitude = Number((label as HTMLElement).dataset.latitude);
        const projected = map.project([longitude, latitude]);
        const mapBounds = mapElement.getBoundingClientRect();
        const labelBounds = label.getBoundingClientRect();
        const horizontalError = Math.abs(
          labelBounds.left + labelBounds.width / 2 - (mapBounds.left + projected.x),
        );
        const verticalError = Math.abs(labelBounds.bottom - (mapBounds.top + projected.y - 8));
        return Math.max(horizontalError, verticalError);
      }),
    )
    .toBeLessThan(1.5);

  await townRange.getByLabel('Minimum town rating').fill('3');
  await expect(townRange).toContainText('3 to 3 stars');
  await expect
    .poll(() =>
      page.locator('.home-town-label:visible').evaluateAll((labels) => ({
        count: labels.length,
        ratings: labels.map((label) => Number((label as HTMLElement).dataset.rating)),
      })),
    )
    .toMatchObject({ count: expect.any(Number), ratings: expect.arrayContaining([3]) });
  expect(
    await page
      .locator('.home-town-label:visible')
      .evaluateAll((labels) => labels.every((label) => (label as HTMLElement).dataset.rating === '3')),
  ).toBe(true);

  await page.getByRole('tab', { name: 'See', exact: true }).click();
  const attractionRange = page.getByRole('group', { name: 'Attraction score range' });
  await expect(attractionRange.getByLabel('Minimum attraction score')).toHaveValue('85');
  await attractionRange.getByLabel('Minimum attraction score').fill('87');
  await attractionRange.getByLabel('Maximum attraction score').fill('88');
  await expect(attractionRange).toContainText('87 to 88');
  await expect
    .poll(() =>
      page.locator('.home-poi-marker.attraction:visible').evaluateAll((markers) => {
        const scores = markers.map((marker) => Number((marker as HTMLElement).dataset.score));
        return scores.length > 0 && scores.every((score) => score >= 87 && score <= 88);
      }),
    )
    .toBe(true);

  await page.getByRole('tab', { name: 'Eat', exact: true }).click();
  const foodRange = page.getByRole('group', { name: 'Food score range' });
  await expect(foodRange.getByLabel('Minimum food score')).toHaveValue('80');
  await expect(foodRange.getByLabel('Maximum food score')).toHaveValue('100');
});

test('uses bundled planner curation outside admin mode even when a local draft exists', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'town-guide-scotland:planner-curation:south-queensferry-scotland',
      JSON.stringify({
        schemaVersion: 1,
        projectId: 'south-queensferry-scotland',
        projectName: 'South Queensferry',
        updatedAt: '2026-08-04T00:00:00.000Z',
        curation: {
          toilets: [
            'osm-community:node-208565198',
            'osm-community:node-1250277056',
            'osm-community:node-1250277086',
            'osm-community:node-9932295752',
            'osm-community:node-10300195913',
            'osm-community:node-13088892512',
            'osm-community:node-14003506933',
            'osm-community:node-14004507531',
          ],
        },
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByText('Change town').click();
  await page.getByLabel('County').selectOption('City of Edinburgh');
  await page.getByLabel('Search towns').fill('South Queensferry');
  await page.getByLabel('Town', { exact: true }).selectOption('south-queensferry-scotland');

  const tripPlanner = page.getByLabel('Town trip planner');
  const toiletsTab = tripPlanner.getByRole('tab', { name: /Toilets/ });
  await expect(toiletsTab).toContainText('4');
  await toiletsTab.click();
  await expect(tripPlanner.getByRole('heading', { name: 'Toilets' })).toBeVisible();
  await expect(tripPlanner.getByText(/^Public toilets$/)).toHaveCount(0);
  await expect(tripPlanner).toContainText('High Street public toilets');
  await expect(tripPlanner).toContainText('Hawes Pier public toilets');
  await expect(tripPlanner).toContainText('Forth Bridges viewpoint toilets');
  await expect(tripPlanner).toContainText('Port Edgar Marina public toilets');
});

test('shows curated attraction facilities and a five-item visit shortlist', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.home-map[data-ready="true"]')).toBeVisible();
  await page.getByRole('tab', { name: 'See', exact: true }).click();
  await page.locator('.home-map').evaluate((element) => {
    const map = (element as HTMLDivElement & { __homeMap?: TestHomeMap }).__homeMap;
    map?.jumpTo({ center: [-0.2426, 52.5726], zoom: 12 });
  });

  const discoveryResults = page.getByLabel('Home discovery results');
  const cathedralCard = discoveryResults
    .getByRole('button')
    .filter({ hasText: 'Peterborough Cathedral' });
  await expect(cathedralCard).toHaveCount(1);
  await cathedralCard.click();

  const placeDetails = page.getByLabel('Home place details');
  await expect(placeDetails.getByRole('heading', { name: 'Plan your visit' })).toBeVisible();
  await expect(placeDetails.getByRole('heading', { name: 'Visitor facilities' })).toBeVisible();
  await expect(placeDetails).toContainText('South Transept doors');
  await expect(
    placeDetails.getByRole('heading', { name: 'Top things to see and do' }),
  ).toBeVisible();
  await expect(placeDetails.locator('.attraction-things-to-do > ol > li')).toHaveCount(5);
  await expect(placeDetails.getByRole('heading', { name: 'Eat here' })).toHaveCount(0);
  await expect(placeDetails.getByText('Picnic', { exact: true })).toHaveCount(0);
});

test('keeps guide captions below town and attraction artwork', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  await expect(page.locator('.home-map[data-ready="true"]')).toBeVisible();
  await page.getByRole('tab', { name: 'See', exact: true }).click();
  await page
    .getByRole('group', { name: 'Places to show' })
    .getByRole('button', { name: 'Outside towns' })
    .click();
  await page.locator('.home-map').evaluate((element) => {
    const map = (element as HTMLDivElement & { __homeMap?: TestHomeMap }).__homeMap;
    map?.jumpTo({ center: [-4.3855056, 56.182462], zoom: 11 });
  });
  const lodgeResult = page
    .getByLabel('Home discovery results')
    .getByRole('button')
    .filter({ hasText: 'The Lodge Forest Visitor Centre and viewpoint' });
  await expect(lodgeResult).toHaveCount(1);
  await lodgeResult.click();

  const attractionGuide = page.getByLabel(
    'The Lodge Forest Visitor Centre and viewpoint attraction guide',
  );
  const attractionHeroLayout = await attractionGuide.evaluate((element) => {
    const media = element.querySelector('.standalone-attraction-hero-media')?.getBoundingClientRect();
    const caption = element.querySelector('figcaption')?.getBoundingClientRect();
    return {
      captionPosition: caption
        ? getComputedStyle(element.querySelector('figcaption') as Element).position
        : null,
      captionTop: caption?.top ?? 0,
      mediaBottom: media?.bottom ?? Number.POSITIVE_INFINITY,
    };
  });
  expect(attractionHeroLayout.captionPosition).not.toBe('absolute');
  expect(attractionHeroLayout.captionTop).toBeGreaterThanOrEqual(
    attractionHeroLayout.mediaBottom - 1,
  );

  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByText('Change town').click();
  await page.getByLabel('Search towns').fill('South Queensferry');
  await page.getByLabel('Town', { exact: true }).selectOption('south-queensferry-scotland');

  const townSnapshot = page.getByLabel('Town visitor snapshot');
  await expect(
    townSnapshot.getByRole('heading', { name: 'South Queensferry', exact: true }),
  ).toBeVisible();
  const townHeroLayout = await townSnapshot.evaluate((element) => {
    const media = element.querySelector('.town-guide-hero-media')?.getBoundingClientRect();
    const caption = element.querySelector('.town-guide-hero-copy')?.getBoundingClientRect();
    return {
      captionPosition: caption
        ? getComputedStyle(element.querySelector('.town-guide-hero-copy') as Element).position
        : null,
      captionTop: caption?.top ?? 0,
      mediaBottom: media?.bottom ?? Number.POSITIVE_INFINITY,
      titleScrollWidth:
        element.querySelector('.town-guide-hero-copy h1')?.scrollWidth ?? Number.POSITIVE_INFINITY,
      titleClientWidth: element.querySelector('.town-guide-hero-copy h1')?.clientWidth ?? 0,
    };
  });
  expect(townHeroLayout.captionPosition).not.toBe('absolute');
  expect(townHeroLayout.captionTop).toBeGreaterThanOrEqual(townHeroLayout.mediaBottom - 1);
  expect(townHeroLayout.titleScrollWidth).toBeLessThanOrEqual(townHeroLayout.titleClientWidth + 1);
});

test('keeps top-tier home scores compact and legible', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.getByRole('tab', { name: 'See', exact: true }).click();
  await page
    .getByRole('group', { name: 'Places to show' })
    .getByRole('button', { name: 'Outside towns' })
    .click();

  const card = page.locator('.home-discovery-results li.score-high button').first();
  await expect(card).toBeVisible();
  const scoreLayout = await card.evaluate((element) => {
    const score = element.querySelector(':scope > em');
    const rank = element.querySelector('.home-result-rank');
    const recommendation = element.querySelector('.planner-recommendation');
    return {
      scoreHeight: score?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY,
      rankHeight: rank?.getBoundingClientRect().height ?? 0,
      scoreAlignSelf: score ? getComputedStyle(score).alignSelf : null,
      scoreColour: score ? getComputedStyle(score).color : null,
      recommendationColour: recommendation ? getComputedStyle(recommendation).color : null,
    };
  });
  expect(scoreLayout.scoreAlignSelf).toBe('start');
  expect(scoreLayout.scoreHeight).toBeLessThan(scoreLayout.rankHeight);
  expect(scoreLayout.scoreColour).toBe('rgb(104, 75, 0)');
  expect(scoreLayout.recommendationColour).toBe(scoreLayout.scoreColour);
});

test('opens the published explorer and information pages', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.goto('/');
  const brandLockup = page.getByRole('button', { name: 'Townscape Guides' });
  await expect(brandLockup).toBeVisible();
  await expect(brandLockup.locator('.brand-mark svg')).toBeVisible();
  await expect(brandLockup.locator('.brand-text')).toContainText('Townscape');
  await expect(brandLockup.locator('.brand-text')).toContainText('Guides');
  await expect(page.getByRole('button', { name: 'Home' })).toHaveClass(/active/);
  await expect(page.getByLabel('Visitor discovery map')).toBeVisible();
  await expect(page.locator('.home-map[data-ready="true"]')).toBeVisible();
  const homeStyleTiles = await page.locator('.home-map').evaluate((element) => {
    const map = (element as HTMLDivElement & { __homeMap?: TestHomeMap }).__homeMap;
    return map?.getStyle().sources.cartoVoyagerNoLabels.tiles ?? [];
  });
  expect(homeStyleTiles[0]).toContain('voyager_nolabels');
  const discoveryModes = page.getByRole('tablist', { name: 'Home discovery modes' });
  const townsMode = discoveryModes.getByRole('tab', { name: 'Towns' });
  const seeMode = discoveryModes.getByRole('tab', { name: 'See' });
  const eatMode = discoveryModes.getByRole('tab', { name: 'Eat' });
  await expect(townsMode).toHaveAttribute('aria-selected', 'true');
  await expect(seeMode).toHaveAttribute('aria-selected', 'false');
  await expect(eatMode).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('.home-poi-marker.attraction').first()).toBeHidden();
  await seeMode.click();
  await expect(seeMode).toHaveAttribute('aria-selected', 'true');
  await expect(townsMode).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByLabel('Home discovery results')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Places worth seeing' })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.home-poi-marker.attraction')
        .evaluateAll((markers) =>
          markers.some((marker) => getComputedStyle(marker).display !== 'none'),
        ),
    )
    .toBe(true);
  await expect(
    page.locator('.home-poi-marker.attraction:visible .home-poi-marker-rank').first(),
  ).toBeVisible();
  await expect(page.locator('.home-poi-marker.attraction .home-poi-name')).toHaveCount(0);
  const visibleAttractionScores = await page
    .locator('.home-poi-marker.attraction')
    .evaluateAll((markers) =>
      markers
        .filter((marker) => getComputedStyle(marker).display !== 'none')
        .map((marker) => Number((marker as HTMLElement).dataset.score)),
    );
  expect(visibleAttractionScores.length).toBeGreaterThan(0);
  expect(visibleAttractionScores.every((score) => score >= 85)).toBe(true);
  const visibleAttractionRanks = await page
    .locator('.home-poi-marker.attraction:visible')
    .evaluateAll((markers) =>
      markers.map((marker) => Number((marker as HTMLElement).dataset.rank)),
    );
  const attractionResultRanks = await page
    .getByLabel('Home discovery results')
    .locator('.home-result-rank')
    .allTextContents();
  expect(visibleAttractionRanks.sort((left, right) => left - right)).toEqual(
    attractionResultRanks.map(Number),
  );
  const visibleAttractionNames = page.locator(
    '.home-poi-marker.attraction:visible .home-poi-marker-name',
  );
  await expect(visibleAttractionNames.first()).toBeAttached();
  expect(
    await visibleAttractionNames.evaluateAll(
      (labels) => labels.filter((label) => getComputedStyle(label).visibility === 'visible').length,
    ),
  ).toBeGreaterThan(0);
  const firstVisibleMarkerLabelLayout = await page
    .locator('.home-poi-marker.attraction:visible')
    .first()
    .evaluate((marker) => {
      const visual = marker.querySelector('.home-poi-marker-visual')?.getBoundingClientRect();
      const label = marker.querySelector('.home-poi-marker-name')?.getBoundingClientRect();
      return {
        visualBottom: visual?.bottom ?? 0,
        labelTop: label?.top ?? 0,
        visualWidth: visual?.width ?? 0,
      };
    });
  expect(firstVisibleMarkerLabelLayout.labelTop).toBeGreaterThanOrEqual(
    firstVisibleMarkerLabelLayout.visualBottom,
  );
  expect(firstVisibleMarkerLabelLayout.visualWidth).toBeLessThanOrEqual(26);
  const attractionMarkerShape = await page
    .locator('.home-poi-marker.attraction:visible .home-poi-marker-visual')
    .first()
    .evaluate((visual) => ({
      borderRadius: getComputedStyle(visual).borderRadius,
      pointerContent: getComputedStyle(visual, '::after').content,
      pointerBottom: getComputedStyle(visual, '::after').bottom,
    }));
  expect(attractionMarkerShape.borderRadius).not.toBe('50%');
  expect(attractionMarkerShape.pointerContent).not.toBe('none');
  expect(attractionMarkerShape.pointerBottom).toBe('-3px');
  const homeMarkerRatingColours = await page.evaluate(() => {
    const colourFor = (selector: string) => {
      const marker = document.querySelector(selector);
      return marker ? getComputedStyle(marker).backgroundColor : '';
    };
    return {
      high: colourFor('.home-poi-marker.score-high .home-poi-marker-visual'),
      recommended: colourFor('.home-poi-marker.score-recommended .home-poi-marker-visual'),
      worthALook: colourFor('.home-poi-marker.score-look .home-poi-marker-visual'),
    };
  });
  expect(homeMarkerRatingColours.high).not.toBe('');
  expect(homeMarkerRatingColours.recommended).not.toBe('');
  expect(homeMarkerRatingColours.worthALook).not.toBe('');
  expect(new Set(Object.values(homeMarkerRatingColours)).size).toBe(3);
  const homeRatingTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      exceptional: styles.getPropertyValue('--rating-exceptional').trim(),
      high: styles.getPropertyValue('--rating-high').trim(),
      foodExceptional: styles.getPropertyValue('--food-exceptional').trim(),
      foodHigh: styles.getPropertyValue('--food-high').trim(),
    };
  });
  expect(homeRatingTokens).toEqual({
    exceptional: '#f6d85f',
    high: '#f1c840',
    foodExceptional: '#d1537b',
    foodHigh: '#b85c86',
  });
  expect(homeRatingTokens.exceptional).not.toBe(homeRatingTokens.foodExceptional);
  expect(homeRatingTokens.high).not.toBe(homeRatingTokens.foodHigh);
  const placeScope = page.getByRole('group', { name: 'Places to show' });
  const allPlacesScope = placeScope.getByRole('button', { name: 'All places' });
  const outsideTownsScope = placeScope.getByRole('button', { name: 'Outside towns' });
  await expect(allPlacesScope).toHaveAttribute('aria-pressed', 'true');
  await expect(outsideTownsScope).toHaveAttribute('aria-pressed', 'false');
  await outsideTownsScope.click();
  await expect(outsideTownsScope).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() =>
      page.locator('.home-poi-marker.attraction').evaluateAll((markers) => {
        const visible = markers.filter((marker) => getComputedStyle(marker).display !== 'none');
        return (
          visible.length > 0 &&
          visible.every((marker) => (marker as HTMLElement).dataset.scope === 'standalone')
        );
      }),
    )
    .toBe(true);
  const lodgeResult = page
    .getByLabel('Home discovery results')
    .getByRole('button')
    .filter({ hasText: 'The Lodge Forest Visitor Centre and viewpoint' });
  await lodgeResult.click();
  const attractionGuide = page.getByLabel(
    'The Lodge Forest Visitor Centre and viewpoint attraction guide',
  );
  await expect(attractionGuide).toBeVisible();
  await expect(attractionGuide.getByRole('img')).toHaveAttribute(
    'src',
    '/attraction-guides/the-lodge-forest-visitor-centre-watercolour-guide.png',
  );
  await expect(
    attractionGuide.getByText('Panoramic views, easy forest trails and a welcoming base'),
  ).toBeVisible();
  await expect(page.getByLabel('Home place details')).toBeVisible();
  expect(
    await attractionGuide
      .locator('img')
      .evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  const attractionHeroLayout = await attractionGuide.evaluate((element) => {
    const media = element.querySelector('.standalone-attraction-hero-media')?.getBoundingClientRect();
    const caption = element.querySelector('figcaption')?.getBoundingClientRect();
    const captionPosition = element.querySelector('figcaption')
      ? getComputedStyle(element.querySelector('figcaption') as Element).position
      : null;
    return {
      captionPosition,
      captionTop: caption?.top ?? 0,
      mediaBottom: media?.bottom ?? Number.POSITIVE_INFINITY,
    };
  });
  expect(attractionHeroLayout.captionPosition).not.toBe('absolute');
  expect(attractionHeroLayout.captionTop).toBeGreaterThanOrEqual(
    attractionHeroLayout.mediaBottom - 1,
  );
  await page.getByRole('button', { name: 'Back to results' }).click();
  await allPlacesScope.click();
  await expect(allPlacesScope).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() =>
      page
        .locator('.home-poi-marker.attraction[data-scope="town"]')
        .evaluateAll((markers) =>
          markers.some((marker) => getComputedStyle(marker).display !== 'none'),
        ),
    )
    .toBe(true);
  const firstHomeResult = page.getByLabel('Home discovery results').locator('li button').first();
  const visibleHomeMarkerState = () =>
    page.locator('.home-poi-marker:visible').evaluateAll((markers) =>
      markers
        .map((marker) => {
          const visual = marker.querySelector('.home-poi-marker-visual');
          return {
            rank: Number((marker as HTMLElement).dataset.rank),
            colour: visual ? getComputedStyle(visual).backgroundColor : '',
          };
        })
        .sort((left, right) => left.rank - right.rank),
    );
  const homeMarkerStateBeforeHover = await visibleHomeMarkerState();
  await firstHomeResult.hover();
  const hoveredHomeMarker = page.locator('.home-poi-marker.hovered');
  await expect(hoveredHomeMarker).toBeVisible();
  await expect(hoveredHomeMarker.locator('.home-poi-marker-name')).toBeVisible();
  const readHomeMarkerPosition = () =>
    hoveredHomeMarker.evaluate((marker) => {
      const markerBounds = marker.getBoundingClientRect();
      const visualBounds = marker.querySelector('.home-poi-marker-visual')?.getBoundingClientRect();
      return {
        markerCentreX: markerBounds.left + markerBounds.width / 2,
        markerCentreY: markerBounds.top + markerBounds.height / 2,
        visualCentreX: visualBounds ? visualBounds.left + visualBounds.width / 2 : 0,
        visualCentreY: visualBounds ? visualBounds.top + visualBounds.height / 2 : 0,
      };
    });
  const homeMarkerStart = await readHomeMarkerPosition();
  await page.waitForTimeout(260);
  const homeMarkerEnd = await readHomeMarkerPosition();
  expect(Math.abs(homeMarkerEnd.markerCentreX - homeMarkerStart.markerCentreX)).toBeLessThan(0.75);
  expect(Math.abs(homeMarkerEnd.markerCentreY - homeMarkerStart.markerCentreY)).toBeLessThan(0.75);
  expect(Math.abs(homeMarkerEnd.visualCentreX - homeMarkerEnd.markerCentreX)).toBeLessThan(0.75);
  expect(Math.abs(homeMarkerEnd.visualCentreY - homeMarkerEnd.markerCentreY)).toBeLessThan(0.75);
  expect(await visibleHomeMarkerState()).toEqual(homeMarkerStateBeforeHover);
  const fallsOfDochartMarker = page.getByRole('button', {
    name: 'Falls of Dochart and historic bridge, Killin, score 89',
    exact: true,
  });
  const fallsOfDochartResult = page
    .getByLabel('Home discovery results')
    .getByRole('button')
    .filter({ hasText: 'Falls of Dochart and historic bridge' });
  const fallsOfDochartRank = await fallsOfDochartResult.locator('.home-result-rank').innerText();
  await expect(fallsOfDochartMarker).toHaveAttribute('data-rank', fallsOfDochartRank);
  await expect(fallsOfDochartMarker.locator('.home-poi-marker-rank')).toHaveText(
    fallsOfDochartRank,
  );
  await fallsOfDochartResult.click();
  await expect(page.getByLabel('Home place details')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Highland waterfall landmark' })).toBeVisible();
  const selectedMarkerPosition = await page
    .locator('.home-poi-marker.selected')
    .evaluate((marker) => {
      const markerBounds = marker.getBoundingClientRect();
      const mapBounds = document.querySelector('.home-map')?.getBoundingClientRect();
      return {
        markerCentreX: markerBounds.left + markerBounds.width / 2,
        markerCentreY: markerBounds.top + markerBounds.height / 2,
        mapLeft: mapBounds?.left ?? 0,
        mapRight: mapBounds?.right ?? 0,
        mapTop: mapBounds?.top ?? 0,
        mapBottom: mapBounds?.bottom ?? 0,
      };
    });
  expect(selectedMarkerPosition.markerCentreX).toBeGreaterThan(selectedMarkerPosition.mapLeft + 42);
  expect(selectedMarkerPosition.markerCentreX).toBeLessThan(selectedMarkerPosition.mapRight - 42);
  expect(selectedMarkerPosition.markerCentreY).toBeGreaterThan(selectedMarkerPosition.mapTop + 42);
  expect(selectedMarkerPosition.markerCentreY).toBeLessThan(selectedMarkerPosition.mapBottom - 42);
  await page.getByRole('button', { name: 'Back to results' }).click();
  await eatMode.click();
  await expect(eatMode).toHaveAttribute('aria-selected', 'true');
  await expect(seeMode).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('heading', { name: 'Top food stops' })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.home-poi-marker.eat')
        .evaluateAll((markers) =>
          markers.some((marker) => getComputedStyle(marker).display !== 'none'),
        ),
    )
    .toBe(true);
  await expect(page.locator('.home-poi-marker.attraction').first()).toBeHidden();
  await expect(
    page.locator('.home-poi-marker.eat:visible .home-poi-marker-rank').first(),
  ).toBeVisible();
  const readVisibleEatRanks = () =>
    page.locator('.home-poi-marker.eat:visible .home-poi-marker-rank').allTextContents();
  await expect
    .poll(async () => {
      const ranks = await readVisibleEatRanks();
      return ranks.length > 0 && ranks.every((rank) => /^\d+$/.test(rank.trim()));
    })
    .toBe(true);
  const topEatMarkerColour = await page
    .locator('.home-poi-marker.eat.score-high:visible .home-poi-marker-visual')
    .first()
    .evaluate((visual) => getComputedStyle(visual).backgroundColor);
  expect(topEatMarkerColour).toBe('rgb(184, 92, 134)');
  const eatMarkerShape = await page
    .locator('.home-poi-marker.eat:visible .home-poi-marker-visual')
    .first()
    .evaluate((visual) => ({
      borderRadius: getComputedStyle(visual).borderRadius,
      handleContent: getComputedStyle(visual, '::after').content,
      handleRight: getComputedStyle(visual, '::after').right,
    }));
  expect(eatMarkerShape.borderRadius).toBe('50%');
  expect(eatMarkerShape.handleContent).not.toBe('none');
  expect(eatMarkerShape.handleRight).toBe('-7px');
  await expect
    .poll(async () => {
      const markerRanks = (await readVisibleEatRanks())
        .map(Number)
        .sort((left, right) => left - right);
      const resultRanks = (
        await page
          .getByLabel('Home discovery results')
          .locator('.home-result-rank')
          .allTextContents()
      ).map(Number);
      return JSON.stringify(markerRanks) === JSON.stringify(resultRanks);
    })
    .toBe(true);
  await expect(page.locator('.home-poi-marker.eat .home-poi-name')).toHaveCount(0);
  await expect(page.locator('.home-poi-marker[data-scope="standalone"]').first()).toBeAttached();
  await outsideTownsScope.click();
  await expect
    .poll(() =>
      page.locator('.home-poi-marker.eat').evaluateAll((markers) => {
        const visible = markers.filter((marker) => getComputedStyle(marker).display !== 'none');
        return visible.every((marker) => (marker as HTMLElement).dataset.scope === 'standalone');
      }),
    )
    .toBe(true);
  const standaloneEatMarkerRanks = await page
    .locator('.home-poi-marker.eat:visible .home-poi-marker-rank')
    .allTextContents();
  const standaloneEatResultRanks = await page
    .getByLabel('Home discovery results')
    .locator('.home-result-rank')
    .allTextContents();
  expect(standaloneEatMarkerRanks.map(Number).sort((left, right) => left - right)).toEqual(
    standaloneEatResultRanks.map(Number),
  );
  await townsMode.click();
  await expect(page.getByLabel('Home discovery results')).toHaveCount(0);
  const firstRatedLabel = page.locator('.home-town-label').first();
  await expect(firstRatedLabel).toBeVisible();
  await expect(firstRatedLabel.locator('.home-town-stars')).toBeVisible();
  await expect(firstRatedLabel.locator('.home-town-name')).toBeVisible();
  await expect(page.getByText('⊘')).toHaveCount(0);
  const hiddenLabelVisibility = await page
    .locator('.home-town-label.hidden')
    .evaluateAll((labels) => labels.map((label) => getComputedStyle(label).visibility));
  expect(hiddenLabelVisibility.length).toBeGreaterThan(0);
  expect(hiddenLabelVisibility.every((visibility) => visibility === 'hidden')).toBe(true);
  const labelLayout = await firstRatedLabel.evaluate((element) => {
    const stars = element.querySelector('.home-town-stars')?.getBoundingClientRect();
    const name = element.querySelector('.home-town-name')?.getBoundingClientRect();
    return {
      projectId: (element as HTMLElement).dataset.projectId ?? '',
      childClasses: [...element.children].map((child) => child.className),
      starsLeft: stars?.left ?? 0,
      nameRight: name?.right ?? 0,
      starColour: getComputedStyle(element.querySelector('.home-town-stars') as Element).color,
    };
  });
  expect(labelLayout.childClasses).toEqual(['home-town-name', 'home-town-stars']);
  expect(labelLayout.starsLeft).toBeGreaterThanOrEqual(labelLayout.nameRight);
  expect(labelLayout.starColour).not.toBe('rgb(0, 0, 0)');
  const townLabelHierarchy = await page.evaluate(() => {
    const styleFor = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return undefined;
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        fontSize: Number.parseFloat(style.fontSize),
        boxShadow: style.boxShadow,
      };
    };
    return {
      one: styleFor('.home-town-label.rating-1'),
      two: styleFor('.home-town-label.rating-2'),
      three: styleFor('.home-town-label.rating-3'),
    };
  });
  expect(townLabelHierarchy.one?.background).toBe('rgba(0, 0, 0, 0)');
  expect(townLabelHierarchy.two?.background).toBe('rgba(0, 0, 0, 0)');
  expect(townLabelHierarchy.three?.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(townLabelHierarchy.three?.fontSize ?? 0).toBeGreaterThan(
    townLabelHierarchy.two?.fontSize ?? 0,
  );
  expect(townLabelHierarchy.two?.fontSize ?? 0).toBeGreaterThan(
    townLabelHierarchy.one?.fontSize ?? 0,
  );
  expect(townLabelHierarchy.one?.boxShadow).toBe('none');
  await firstRatedLabel.click();
  await expect(page.getByRole('button', { name: 'Explore', exact: true })).toHaveClass(/active/);
  await expect(page.getByLabel('Town', { exact: true })).toHaveValue(labelLayout.projectId);
  await page.getByRole('button', { name: 'Back to Home' }).click();
  await expect(page.getByRole('button', { name: 'Home' })).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.locator('.sidebar-guide-label')).toContainText('Destination guide');
  await brandLockup.click();
  await expect(page.getByRole('button', { name: 'Home' })).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByLabel('Map layer controls')).toHaveCount(0);
  await page.getByRole('button', { name: 'Map options' }).click();
  await expect(page.getByLabel('Map style')).toHaveValue('voyager');
  await expect(page.getByLabel('Map style')).toContainText('Stadia Terrain');
  const exploreStyleTiles = await page.locator('.map').evaluate((element) => {
    const map = (element as HTMLDivElement & { __exploreMap?: TestExploreMap }).__exploreMap;
    return map?.getStyle().sources.cartoVoyager.tiles ?? [];
  });
  expect(exploreStyleTiles[0]).toContain('/voyager/');
  const heatMapSwitch = page.getByLabel('Heritage glow');
  const historicPlacesSwitch = page.getByLabel('Heritage pins');
  const osmPointsSwitch = page.getByLabel('Visitor pins');
  const historyTimelineSwitch = page.getByRole('checkbox', { name: 'Timeline' });
  const heatMapToggle = page.locator('.map-layer-switch').filter({ hasText: 'Heritage glow' });
  const historicPlacesToggle = page
    .locator('.map-layer-switch')
    .filter({ hasText: 'Heritage pins' });
  const historyTimelineToggle = page.locator('.map-layer-switch').filter({ hasText: 'Timeline' });
  await expect(heatMapSwitch).toBeChecked();
  await expect(historicPlacesSwitch).not.toBeChecked();
  await expect(osmPointsSwitch).not.toBeChecked();
  await expect(historyTimelineSwitch).not.toBeChecked();
  await expect(page.locator('.timeline')).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator('.map').evaluate((element) => {
        const map = (element as HTMLDivElement & { __exploreMap?: TestExploreMap }).__exploreMap;
        return {
          heat: map?.getLayoutProperty('historic-character-heatmap', 'visibility'),
          places: map?.getLayoutProperty('heritage-features', 'visibility'),
          osm: map?.getLayoutProperty('osm-community-places', 'visibility'),
        };
      }),
    )
    .toEqual({ heat: 'visible', places: 'none', osm: 'none' });
  await historicPlacesToggle.click();
  await expect(historicPlacesSwitch).toBeChecked();
  await heatMapToggle.click();
  await expect(heatMapSwitch).not.toBeChecked();
  await expect(osmPointsSwitch).not.toBeChecked();
  await expect
    .poll(() =>
      page.locator('.map').evaluate((element) => {
        const map = (element as HTMLDivElement & { __exploreMap?: TestExploreMap }).__exploreMap;
        return {
          heat: map?.getLayoutProperty('historic-character-heatmap', 'visibility'),
          places: map?.getLayoutProperty('heritage-features', 'visibility'),
          osm: map?.getLayoutProperty('osm-community-places', 'visibility'),
        };
      }),
    )
    .toEqual({ heat: 'none', places: 'visible', osm: 'none' });
  await heatMapToggle.click();
  await historicPlacesToggle.click();
  await historyTimelineToggle.click();
  await expect(historyTimelineSwitch).toBeChecked();
  await expect(page.locator('.timeline')).toBeVisible();
  await historyTimelineToggle.click();
  await expect(page.locator('.timeline')).toHaveCount(0);
  await page.getByText('Change town').click();
  await page.getByLabel('Country').selectOption('Scotland');
  await expect(page.getByLabel('Country')).toHaveValue('Scotland');
  await expect(page.getByText('Data status:')).toHaveCount(0);
  await page.getByLabel('County').selectOption('Clackmannanshire');
  await page.getByLabel('Search towns').fill('Alloa');
  await page.getByLabel('Town', { exact: true }).selectOption('alloa-scotland');
  await expect(page.getByLabel('Town', { exact: true })).toHaveValue('alloa-scotland');
  await page.getByLabel('Search towns').fill('Alva');
  await page.getByLabel('Town', { exact: true }).selectOption('alva-scotland');
  await expect(page.getByLabel('Town', { exact: true })).toHaveValue('alva-scotland');
  await expect(page.getByRole('heading', { name: 'Alva', exact: true })).toBeVisible();
  await expect(page.getByLabel('County')).toHaveValue('Clackmannanshire');
  await page.getByLabel('Search towns').fill('Kirriemuir');
  await page.getByLabel('Town', { exact: true }).selectOption('kirriemuir-scotland');
  await expect(page.getByLabel('Town', { exact: true })).toHaveValue('kirriemuir-scotland');
  await expect(page.getByLabel('County')).toHaveValue('Angus');
  await page.getByText('Change town').click();
  const townSnapshot = page.getByLabel('Town visitor snapshot');
  await expect(townSnapshot.getByRole('heading', { name: 'Kirriemuir' })).toBeVisible();
  const townHeroLayout = await townSnapshot.evaluate((element) => {
    const media = element.querySelector('.town-guide-hero-media')?.getBoundingClientRect();
    const caption = element.querySelector('.town-guide-hero-copy')?.getBoundingClientRect();
    const captionPosition = element.querySelector('.town-guide-hero-copy')
      ? getComputedStyle(element.querySelector('.town-guide-hero-copy') as Element).position
      : null;
    return {
      captionPosition,
      captionTop: caption?.top ?? 0,
      mediaBottom: media?.bottom ?? Number.POSITIVE_INFINITY,
    };
  });
  expect(townHeroLayout.captionPosition).not.toBe('absolute');
  expect(townHeroLayout.captionTop).toBeGreaterThanOrEqual(townHeroLayout.mediaBottom - 1);
  await expect(
    townSnapshot.getByRole('heading', {
      name: 'Storybook streets, rock history and a hilltop view of Angus',
    }),
  ).toBeVisible();
  await expect(townSnapshot).toContainText('Half day');
  await expect(townSnapshot.getByText('Start here')).toBeVisible();
  await expect(townSnapshot).toContainText("J M Barrie's Birthplace");
  await expect(page.getByRole('button', { name: 'Guide options' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open settings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enable admin curation mode' })).toHaveCount(0);
  await expect(townSnapshot.getByLabel('Town character')).toHaveCount(1);
  await expect(townSnapshot.locator('.town-motif')).toHaveCount(4);
  await expect(townSnapshot.locator('.town-motif').getByRole('button')).toHaveCount(0);
  await expect(
    page.getByRole('img', {
      name: 'Editorial illustration of Kirriemuir town centre with the Peter Pan statue and red sandstone clock building',
    }),
  ).toBeVisible();
  await expect(townSnapshot).not.toContainText(/parking|toilets/i);
  await expect(
    townSnapshot.getByRole('heading', { name: "J M Barrie's Birthplace" }),
  ).toBeVisible();
  await expect(townSnapshot.getByText('Perfect for')).toBeVisible();
  await expect(townSnapshot).toContainText('A half-day story walk');
  await expect(townSnapshot.getByText('Suggested first visit')).toBeVisible();
  await expect(townSnapshot).toContainText('Birthplace, statues and Kirrie Hill');
  const guideBeforeTownPicker = await page.locator('.sidebar').evaluate((element) => {
    const guide = element.querySelector('.town-visit-hero')?.getBoundingClientRect();
    const picker = element.querySelector('.town-picker')?.getBoundingClientRect();
    return {
      guideTop: guide?.top ?? Number.POSITIVE_INFINITY,
      pickerTop: picker?.top ?? 0,
    };
  });
  expect(guideBeforeTownPicker.guideTop).toBeLessThan(guideBeforeTownPicker.pickerTop);
  const sidebarScroll = await page.locator('.sidebar').evaluate((element) => ({
    clientHeight: element.clientHeight,
    width: element.getBoundingClientRect().width,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
    introClamp: getComputedStyle(element.querySelector('.town-guide-intro') as Element)
      .webkitLineClamp,
    moodClamp: getComputedStyle(element.querySelector('.town-guide-mood') as Element)
      .webkitLineClamp,
  }));
  expect(sidebarScroll.overflowY).toBe('hidden');
  expect(sidebarScroll.width).toBeGreaterThanOrEqual(390);
  expect(sidebarScroll.scrollHeight).toBeLessThanOrEqual(sidebarScroll.clientHeight + 1);
  expect(sidebarScroll.introClamp).toBe('none');
  expect(sidebarScroll.moodClamp).toBe('none');
  const startHereLayout = await page.locator('.town-first-stop').evaluate((element) => {
    const button = element.querySelector('.town-first-stop-action')?.getBoundingClientRect();
    const card = element.getBoundingClientRect();
    return {
      cardHeight: card.height,
      buttonBottom: button?.bottom ?? card.bottom,
      cardBottom: card.bottom,
    };
  });
  expect(startHereLayout.cardHeight).toBeLessThan(150);
  expect(startHereLayout.cardBottom - startHereLayout.buttonBottom).toBeLessThan(18);
  await expect(page.getByText('Find a mapped place')).toHaveCount(0);
  await expect(page.locator('fieldset').filter({ hasText: 'Historic map' })).toHaveCount(0);
  await page.getByText('Change town').click();
  await page.getByLabel('Search towns').fill('Kirriemuir');
  await page.getByLabel('Town', { exact: true }).selectOption('kirriemuir-scotland');
  const tripPlanner = page.getByLabel('Town trip planner');
  await expect(tripPlanner.getByRole('heading', { name: 'Kirriemuir in one visit' })).toBeVisible();
  await expect(tripPlanner.getByRole('tab', { name: /See/ })).toBeVisible();
  await expect(tripPlanner.getByRole('tab', { name: /Eat/ })).toBeVisible();
  await expect(tripPlanner.getByRole('tab', { name: /Trails/ })).toBeVisible();
  await expect(tripPlanner.getByRole('tab', { name: /Picnic/ })).toBeVisible();
  await expect(tripPlanner.getByRole('tab', { name: /Parking/ })).toBeVisible();
  await expect(tripPlanner.getByRole('tab', { name: /Toilets/ })).toBeVisible();
  await expect(tripPlanner.getByRole('tab', { name: /Walk/ })).toHaveCount(0);
  await expect(tripPlanner.getByRole('tab', { name: /Photo/ })).toHaveCount(0);
  await expect(tripPlanner.getByRole('tab', { name: /Parks/ })).toHaveCount(0);
  await expect(tripPlanner.getByRole('tab', { name: /Eat/ })).toContainText('8');
  await tripPlanner.getByRole('tab', { name: /Eat/ }).click();
  await expect(tripPlanner.getByRole('heading', { name: 'Cafes & food' })).toBeVisible();
  await expect(tripPlanner.locator('.planner-card.eat .badge-pay')).toHaveCount(0);
  const cafeScoreCard = tripPlanner.getByRole('button').filter({
    hasText: 'The Garden Cafe at Pathhead Farm',
  });
  await expect(cafeScoreCard.locator('.planner-score')).toHaveText('79');
  await expect(cafeScoreCard).toContainText('Great choice');
  await expect(cafeScoreCard).toContainText('Best all-round');
  await expect(cafeScoreCard).toContainText('££');
  await expect(cafeScoreCard.locator('.dog-paw-badge')).toHaveAttribute(
    'title',
    '2 paws out of 3: Dog friendly',
  );
  await expect(cafeScoreCard).not.toContainText('Best all-round option:');
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: '88 Degrees Coffee House' }),
  ).toContainText('Best coffee & cake');
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Airlie Arms Hotel & Restaurant' }),
  ).toContainText('Full-menu choice');
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Three Bellies Brae' }),
  ).toContainText('Pub lunch');
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Saucy Asian Lunch Club' }),
  ).toContainText('Asian street food');
  await tripPlanner.getByRole('tab', { name: /See/ }).click();
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: "J M Barrie's Birthplace" }),
  ).toContainText('Peter Pan origin');
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Kirriemuir Camera Obscura' }),
  ).toContainText('Hilltop view');
  await tripPlanner.getByRole('tab', { name: /Eat/ }).click();
  await expect(osmPointsSwitch).toBeChecked();
  await expect
    .poll(() =>
      page.locator('.map').evaluate((element) => {
        const map = (element as HTMLDivElement & { __exploreMap?: TestExploreMap }).__exploreMap;
        return map?.getLayoutProperty('osm-community-places', 'visibility');
      }),
    )
    .toBe('visible');
  async function visiblePlannerPoiSource() {
    return page.locator('.map').evaluate((element) => {
      const map = (element as HTMLDivElement & { __exploreMap?: TestExploreMap }).__exploreMap;
      const features = map?.querySourceFeatures('osm-community-places') ?? [];
      return {
        ids: [...new Set(features.map((feature) => feature.properties?.id).filter(Boolean))].sort(),
        iconSize: map?.getLayoutProperty('osm-community-places', 'icon-size'),
        markerCategories: [
          ...new Set(features.map((feature) => feature.properties?.markerCategory).filter(Boolean)),
        ].sort(),
        names: [
          ...new Set(features.map((feature) => feature.properties?.name).filter(Boolean)),
        ].sort(),
      };
    });
  }
  const curatedEatMapPois = await page.locator('.map').evaluate((element) => {
    const map = (element as HTMLDivElement & { __exploreMap?: TestExploreMap }).__exploreMap;
    const features = map?.querySourceFeatures('osm-community-places') ?? [];
    return {
      iconSize: map?.getLayoutProperty('osm-community-places', 'icon-size'),
      markerCategories: [
        ...new Set(features.map((feature) => feature.properties?.markerCategory).filter(Boolean)),
      ].sort(),
      names: [
        ...new Set(features.map((feature) => feature.properties?.name).filter(Boolean)),
      ].sort(),
    };
  });
  expect(curatedEatMapPois.iconSize).toBe(0.55);
  expect(curatedEatMapPois.markerCategories).toEqual(['food']);
  expect(curatedEatMapPois.names).toEqual([
    '88 Degrees Coffee House',
    'A Longer Table Community Coffee Room',
    'Airlie Arms Hotel & Restaurant',
    'Cafe Obscura',
    "Lee's Takeaway & Coffee Shop",
    'Saucy Asian Lunch Club',
    'The Garden Cafe at Pathhead Farm',
    'Three Bellies Brae',
  ]);
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Kirriemuir Golf Club' }),
  ).toHaveCount(0);
  await cafeScoreCard.hover();
  await expect(page.locator('.map-hover-bounce--visitor')).toBeVisible();
  await expect(page.locator('.map-hover-bounce--visitor')).toHaveAttribute('data-category', 'eat');
  await page.mouse.move(20, 20);
  await expect(page.locator('.map-hover-bounce--visitor')).toHaveCount(0);
  await cafeScoreCard.click();
  await expect(page.getByRole('button', { name: 'Back to list' })).toBeVisible();
  await expect(page.locator('.place-details')).toContainText('A proper farm cafe');
  await expect(page.locator('.place-details')).not.toContainText('Best all-round option:');
  await expect(page.locator('.planner-detail-pills .badge-price-band')).toHaveCount(0);
  await expect(page.locator('.planner-detail-facts')).toContainText('Typical spend');
  await expect(page.locator('.quick-facts')).not.toContainText('Opening');
  await expect(page.locator('.quick-facts')).not.toContainText('Price guide');
  await expect(page.locator('.quick-facts')).not.toContainText('Good for');
  await expect(page.locator('.quick-facts')).not.toContainText('Time to spend');
  await expect(page.getByRole('heading', { name: 'Visiting with a dog' })).toBeVisible();
  await expect(page.locator('.dog-access-section')).toContainText('2/3');
  await expect(page.locator('.dog-access-section')).toContainText('Dog friendly');
  await expect(page.getByRole('heading', { name: 'Visit details' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to list' }).click();
  await expect(page.getByLabel('Town trip planner')).toBeVisible();
  await expect(tripPlanner.getByRole('heading', { name: 'Cafes & food' })).toBeVisible();
  await tripPlanner.getByRole('tab', { name: /See/ }).click();
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: "J M Barrie's Birthplace" }),
  ).toBeVisible();
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Kirriemuir Camera Obscura' }),
  ).toBeVisible();
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Tayside Police Museum' }),
  ).toBeVisible();
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Bon Scott Statue' }),
  ).toBeVisible();
  await expect(tripPlanner.getByRole('button').filter({ hasText: 'Kirriemuir Den' })).toBeVisible();
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Kirrie Hill viewpoint and public park' }),
  ).toBeVisible();
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Peter Pan Statue' }),
  ).toBeVisible();
  await expect(
    tripPlanner
      .getByRole('button')
      .filter({ hasText: "Kirriemuir Cemetery, Barrie's grave and war memorial" }),
  ).toBeVisible();
  await expect(tripPlanner.getByRole('button').filter({ hasText: 'Neverland Park' })).toBeVisible();
  await expect
    .poll(async () => (await visiblePlannerPoiSource()).ids)
    .toEqual([
      'osm-community:node-13264886726',
      'osm-community:node-5294830098',
      'osm-community:node-5294830205',
      'osm-community:node-5294830264',
      'osm-community:node-5893732662',
      'osm-community:node-6634975384',
      'osm-community:way-164703492',
      'osm-community:way-548034712',
      'osm-community:way-574801962',
    ]);
  await tripPlanner.getByRole('tab', { name: /Picnic/ }).click();
  await expect(tripPlanner.getByRole('heading', { name: 'Picnic areas' })).toBeVisible();
  await expect
    .poll(async () => await visiblePlannerPoiSource())
    .toMatchObject({
      ids: ['osm-community:node-13264886749', 'osm-community:node-2050736820'],
      markerCategories: ['picnic'],
    });
  await tripPlanner.getByRole('tab', { name: /Toilets/ }).click();
  await expect(tripPlanner.getByRole('heading', { name: 'Toilets' })).toBeVisible();
  await expect
    .poll(async () => await visiblePlannerPoiSource())
    .toMatchObject({
      ids: [
        'osm-community:node-5893732663',
        'osm-community:way-1314221838',
        'osm-community:way-548880054',
      ],
      markerCategories: ['amenities'],
    });
  await tripPlanner.getByRole('tab', { name: /See/ }).click();
  const birthplaceCard = tripPlanner.getByRole('button').filter({
    hasText: "J M Barrie's Birthplace",
  });
  await expect(birthplaceCard.locator('.planner-score')).toHaveText('68');
  await expect(birthplaceCard).toContainText('Worth a look');
  await expect(birthplaceCard.locator('.planner-card-pills .badge-pay')).toHaveText('Pay');
  await expect(birthplaceCard.locator('.planner-card-pills .badge-nts')).toHaveText('NTS');
  await expect(birthplaceCard.locator('.dog-paw-badge')).toHaveAttribute(
    'title',
    '0 paws out of 3: Dog policy not confirmed',
  );
  await expect(birthplaceCard).not.toContainText('Adult £10');
  const cameraCard = tripPlanner.getByRole('button').filter({
    hasText: 'Kirriemuir Camera Obscura',
  });
  await expect(cameraCard.locator('.planner-score')).toHaveText('66');
  await expect(cameraCard.locator('.planner-card-pills .badge-free')).toHaveText('Free');
  await expect(cameraCard.locator('.dog-paw-badge')).toHaveAttribute(
    'title',
    '1 paw out of 3: Limited dog access',
  );
  await expect(cameraCard).not.toContainText('Saturday, Sunday and Monday');
  const plannerScrollBehaviour = await tripPlanner.evaluate((element) => {
    const masthead = element.querySelector('.planner-masthead');
    const results = element.querySelector('.planner-scroll-region');
    if (!masthead || !(results instanceof HTMLElement)) {
      return {
        mastheadTopBefore: Number.POSITIVE_INFINITY,
        mastheadTopAfter: Number.NEGATIVE_INFINITY,
        resultsScrolled: false,
        plannerOverflow: '',
      };
    }
    const mastheadTopBefore = masthead.getBoundingClientRect().top;
    results.scrollTop = 240;
    const mastheadTopAfter = masthead.getBoundingClientRect().top;
    return {
      mastheadTopBefore,
      mastheadTopAfter,
      resultsScrolled: results.scrollTop > 0,
      plannerOverflow: getComputedStyle(element).overflowY,
    };
  });
  expect(plannerScrollBehaviour.resultsScrolled).toBe(true);
  expect(plannerScrollBehaviour.plannerOverflow).toBe('hidden');
  expect(
    Math.abs(plannerScrollBehaviour.mastheadTopAfter - plannerScrollBehaviour.mastheadTopBefore),
  ).toBeLessThan(1);
  await expect(page.locator('.map-hover-bounce--visitor')).toHaveCount(0);
  const birthplaceGuideButton = tripPlanner.getByRole('button', {
    name: /J M Barrie's Birthplace/,
  });
  await birthplaceGuideButton.hover();
  await expect(page.locator('.map-hover-bounce--visitor')).toBeVisible();
  await expect(page.locator('.map-hover-bounce--visitor')).toHaveAttribute('data-category', 'see');
  await page.waitForTimeout(320);
  const pulsingIconAlignment = await page.locator('.map-hover-bounce--visitor').evaluate((icon) => {
    const iconBox = icon.getBoundingClientRect();
    const markerBox = icon.parentElement?.getBoundingClientRect();
    return {
      dx: markerBox
        ? Math.abs(iconBox.left + iconBox.width / 2 - (markerBox.left + markerBox.width / 2))
        : Number.POSITIVE_INFINITY,
      dy: markerBox
        ? Math.abs(iconBox.top + iconBox.height / 2 - (markerBox.top + markerBox.height / 2))
        : Number.POSITIVE_INFINITY,
    };
  });
  expect(pulsingIconAlignment.dx).toBeLessThan(0.75);
  expect(pulsingIconAlignment.dy).toBeLessThan(0.75);
  const visitorStarAlignment = await page.locator('.map').evaluate((element) => {
    const map = (element as HTMLDivElement & { __exploreMap?: TestExploreMap }).__exploreMap;
    if (!map) return { dx: Number.POSITIVE_INFINITY, dy: Number.POSITIVE_INFINITY };
    const projected = map.project({ lng: -3.0016744, lat: 56.6741408 });
    const mapBox = element.getBoundingClientRect();
    const markerBox = document.querySelector('.map-hover-marker')?.getBoundingClientRect();
    if (!markerBox) return { dx: Number.POSITIVE_INFINITY, dy: Number.POSITIVE_INFINITY };
    return {
      dx: Math.abs(markerBox.left + markerBox.width / 2 - (mapBox.left + projected.x)),
      dy: Math.abs(markerBox.top + markerBox.height / 2 - (mapBox.top + projected.y)),
    };
  });
  expect(visitorStarAlignment.dx).toBeLessThan(3);
  expect(visitorStarAlignment.dy).toBeLessThan(3);
  await birthplaceGuideButton.click();
  await expect(page.getByRole('button', { name: 'Show source notes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Peter Pan origin' })).toBeVisible();
  await expect(page.locator('.place-details')).toContainText(
    "A compact National Trust for Scotland visit at the heart of Kirriemuir's Peter Pan story.",
  );
  await expect(page.locator('.place-details')).not.toContainText('inside the town boundary');
  await expect(page.locator('.place-details')).not.toContainText('parish heat scoring');
  await expect(page.locator('.place-details')).not.toContainText('Map listing');
  await expect(page.getByRole('heading', { name: 'Visit details' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Plan your visit' })).toBeVisible();
  await expect(page.locator('.planner-detail-pills .badge-pay')).toHaveText('Pay');
  await expect(page.locator('.planner-detail-pills .badge-nts')).toHaveText('NTS');
  await expect(page.locator('.planner-detail-facts')).toContainText('Adult £10');
  await expect(page.locator('.planner-detail-facts')).toContainText('26 March-25 October');
  await expect(page.getByRole('heading', { name: 'Useful to know' })).toBeVisible();
  await expect(page.locator('.quick-facts')).toContainText('45-60 minutes');
  await expect(page.getByRole('heading', { name: 'Visiting with a dog' })).toBeVisible();
  await expect(page.locator('.dog-access-section')).toContainText('0/3');
  await expect(page.locator('.dog-access-section')).toContainText('Dog policy not confirmed');
  await page.getByRole('button', { name: 'Back to list' }).click();
  await tripPlanner.getByRole('tab', { name: /Parking/ }).click();
  await expect(tripPlanner.getByRole('tab', { name: /Parking/ })).toContainText('4');
  await expect(tripPlanner.getByRole('heading', { name: 'Parking' })).toBeVisible();
  const reformStreetParking = tripPlanner.getByRole('button').filter({
    hasText: 'Reform Street Car Park',
  });
  await expect(reformStreetParking).toBeVisible();
  await expect(reformStreetParking).not.toContainText(
    'Free short-stay public car park close to Kirriemuir town centre.',
  );
  await expect(
    tripPlanner.getByRole('button').filter({
      hasText: 'Customer parking behind Reform Street buildings',
    }),
  ).toHaveCount(0);
  await expect(
    tripPlanner.getByRole('button').filter({ hasText: 'Hill / Barrie Pavilion Car Park' }),
  ).toBeVisible();
  await reformStreetParking.click();
  await expect(page.locator('.place-details')).toContainText(
    'Free short-stay public car park close to Kirriemuir town centre.',
  );
  await expect(page.getByRole('heading', { name: 'Why go' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Parking details' })).toBeVisible();
  await expect(page.locator('.quick-facts')).toContainText('Spaces');
  await expect(page.locator('.quick-facts')).toContainText('63');
  await expect(page.locator('.quick-facts')).toContainText('Open surface car park');
  await expect(page.locator('.quick-facts')).not.toContainText('Good for');
  await expect(page.locator('.quick-facts')).not.toContainText('Time to spend');
  await expect(page.locator('.quick-facts')).toContainText('Pricing');
  await expect(page.locator('.quick-facts')).toContainText('Free');
  await expect(page.locator('.quick-facts')).toContainText('Max stay');
  await expect(page.locator('.quick-facts')).toContainText('4 hours');
  await page.getByRole('button', { name: 'Show source notes' }).click();
  await expect(page.getByRole('heading', { name: 'Where this came from' })).toBeVisible();
  await expect(page.getByLabel('Only community layers')).toBeHidden();
  await page.getByRole('button', { name: 'Guide options' }).click();
  await expect(page.getByRole('menu', { name: 'Guide options' })).toBeVisible();
  await page.getByRole('menuitemcheckbox', { name: 'Admin mode' }).click();
  await expect(osmPointsSwitch).toBeChecked();
  await expect
    .poll(() =>
      page.locator('.map').evaluate((element) => {
        const map = (element as HTMLDivElement & { __exploreMap?: TestExploreMap }).__exploreMap;
        return [
          ...new Set(
            map
              ?.querySourceFeatures('osm-community-places')
              .map((feature) => feature.properties?.markerCategory) ?? [],
          ),
        ]
          .filter(Boolean)
          .sort();
      }),
    )
    .toEqual(
      expect.arrayContaining([
        'amenities',
        'art',
        'food',
        'historic',
        'leisure',
        'memorial',
        'nature',
        'parking',
        'picnic',
        'visitor',
      ]),
    );
  await page.getByRole('button', { name: 'Guide options' }).click();
  await page.getByRole('menuitem', { name: 'Explorer settings' }).click();
  await expect(page.getByLabel('Enable planner curation')).toBeChecked();
  await expect(page.getByLabel('Show OSM category icons')).toBeChecked();
  await expect(page.getByLabel('Only community layers')).toBeVisible();
  await expect(page.getByLabel('Show historic-date colours')).toBeChecked();
  await expect(page.getByLabel('Food & drink')).toBeChecked();
  await expect(page.getByLabel('Picnic & rest')).toBeChecked();
  await expect(page.getByLabel('Art & culture')).toBeChecked();
  await expect(page.getByLabel('Memorials & plaques')).toBeChecked();
  await expect(page.getByLabel('Historic places')).toBeChecked();
  await expect(page.getByLabel('Leisure')).toBeChecked();
  await expect(page.getByLabel('Visitor information')).toBeChecked();
  await expect(page.getByLabel('Amenities')).toBeChecked();
  await expect(page.getByLabel('Parking')).toBeChecked();
  await expect(page.getByLabel('Natural sights')).toBeChecked();
  await page.getByLabel('Show OSM category icons').check();
  await expect(page.getByLabel('Show OSM category icons')).toBeChecked();
  await page.getByLabel('Only community layers').check();
  await expect(page.getByLabel('Show public art')).toBeChecked();
  await expect(page.getByLabel('Show plaques & memorials')).toBeChecked();
  await expect(page.getByLabel('Food & drink')).toBeChecked();
  await expect(page.getByLabel('Picnic & rest')).toBeChecked();
  await expect(page.getByLabel('Art & culture')).toBeChecked();
  await expect(page.getByLabel('Memorials & plaques')).toBeChecked();
  await expect(page.getByLabel('Historic places')).toBeChecked();
  await expect(page.getByLabel('Leisure')).toBeChecked();
  await expect(page.getByLabel('Visitor information')).toBeChecked();
  await expect(page.getByLabel('Amenities')).toBeChecked();
  await expect(page.getByLabel('Parking')).toBeChecked();
  await expect(page.getByLabel('Natural sights')).toBeChecked();
  await page.getByLabel('Only community layers').uncheck();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Explorer settings' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Guide options' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Admin mode on' }).click();
  await expect(osmPointsSwitch).not.toBeChecked();
  await expect
    .poll(() =>
      page.locator('.map').evaluate((element) => {
        const map = (element as HTMLDivElement & { __exploreMap?: TestExploreMap }).__exploreMap;
        return map?.getLayoutProperty('osm-community-places', 'visibility');
      }),
    )
    .toBe('none');
  await page.getByLabel('County').selectOption('Clackmannanshire');
  await page.getByLabel('Search towns').fill('Tillicoultry');
  await page.getByLabel('Town', { exact: true }).selectOption('tillicoultry-scotland');
  await expect(page.getByLabel('Town', { exact: true })).toHaveValue('tillicoultry-scotland');
  await expect(page.getByRole('heading', { name: 'Tillicoultry', exact: true })).toBeVisible();
  await expect(page.locator('fieldset').filter({ hasText: 'Historic map' })).toHaveCount(0);
  const tillicoultryPlanner = page.getByLabel('Town trip planner');
  await tillicoultryPlanner.getByRole('tab', { name: /Eat/ }).click();
  await expect(tillicoultryPlanner.getByRole('heading', { name: 'Cafes & food' })).toBeVisible();
  await tillicoultryPlanner.getByRole('tab', { name: /Parking/ }).click();
  await expect(tillicoultryPlanner.getByRole('heading', { name: 'Parking' })).toBeVisible();
  await tillicoultryPlanner.getByRole('tab', { name: /Toilets/ }).click();
  await expect(tillicoultryPlanner.getByRole('heading', { name: 'Toilets' })).toBeVisible();
  await tillicoultryPlanner.getByRole('tab', { name: /Picnic/ }).click();
  await expect(tillicoultryPlanner.getByRole('heading', { name: 'Picnic areas' })).toBeVisible();
  await tillicoultryPlanner.getByRole('tab', { name: /Trails/ }).click();
  await expect(tillicoultryPlanner.getByRole('heading', { name: 'Town trails' })).toBeVisible();
  await expect(tillicoultryPlanner.getByRole('tab', { name: /Walk/ })).toHaveCount(0);
  await expect(tillicoultryPlanner.getByRole('tab', { name: /Photo/ })).toHaveCount(0);
  await expect(tillicoultryPlanner.getByRole('tab', { name: /Parks/ })).toHaveCount(0);
  await page.getByLabel('County').selectOption('Fife');
  await page.getByLabel('Search towns').fill('Kincardine');
  await page.getByLabel('Town', { exact: true }).selectOption('kincardine-on-forth-scotland');
  await expect(page.getByLabel('Town', { exact: true })).toHaveValue(
    'kincardine-on-forth-scotland',
  );
  await expect(
    page.getByRole('heading', { name: 'Kincardine-on-Forth', exact: true }),
  ).toBeVisible();
  await page.getByLabel('County').selectOption('Clackmannanshire');
  await page.getByLabel('Search towns').fill('Alloa');
  await page.getByLabel('Town', { exact: true }).selectOption('alloa-scotland');
  await page.getByRole('button', { name: 'Guide options' }).click();
  await page.getByRole('menuitem', { name: 'Explorer settings' }).click();
  const currentContext = page.getByLabel('Show current parks & open spaces');
  await expect(currentContext).toBeChecked();
  const cafes = page.getByLabel('Food & drink');
  await cafes.uncheck();
  await cafes.check();
  await expect(cafes).toBeChecked();
  const excludeUndated = page.getByLabel('Show only entries with established dates');
  await expect(excludeUndated).not.toBeChecked();
  await excludeUndated.check();
  await expect(excludeUndated).toBeChecked();
  const hesImage = page.waitForResponse(
    (response) =>
      response.url().includes('/api/hes-designations/') &&
      response.status() === 200 &&
      response.headers()['content-type']?.includes('image/png') === true,
  );
  await page.getByLabel('Show current HES designations (external symbols)').check();
  await hesImage;
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Explorer settings' })).toHaveCount(0);
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('menuitem', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'How it works' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Sources' }).click();
  await expect(page.getByRole('heading', { name: 'Sources & licences' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Download Alloa listed buildings/i }),
  ).toHaveAttribute('href', '/api/projects/alloa-scotland/exports/listed-buildings.csv');
  await page.getByRole('button', { name: 'About' }).click();
  await page.getByRole('menuitem', { name: 'Curator tools' }).click();
  await expect(page.getByRole('heading', { name: 'Curator review' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download undated heritage CSV' })).toHaveAttribute(
    'href',
    '/api/projects/alloa-scotland/exports/undated-heritage-review.csv',
  );
  await page.getByLabel('Review queue').selectOption('date');
  await expect(page.getByRole('heading', { name: /record\(s\) to review/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save research note' })).toBeVisible();
});
