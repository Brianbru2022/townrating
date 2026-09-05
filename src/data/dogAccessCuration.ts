import dogAccessLibrary from '../../data/dog-access-curation.json';
import eastNeukDogAccessLibrary from '../../data/east-neuk-dog-access-curation.json';
import crailDogAccessLibrary from '../../data/crail-dog-access-curation.json';
import cairnOMountDogAccessLibrary from '../../data/cairn-o-mount-dog-access-curation.json';
import stonehavenCoastDogAccessLibrary from '../../data/stonehaven-coast-dog-access-curation.json';
import aberdeenNorthDogAccessLibrary from '../../data/aberdeen-north-dog-access-curation.json';
import carseGowrieDogAccessLibrary from '../../data/carse-gowrie-dog-access-curation.json';
import type { DogAccessInfo } from '../domain/dogAccess';

export type DogAccessPlaceKind = 'attraction' | 'eat';

interface ProjectDogAccess {
  attraction?: Record<string, DogAccessInfo>;
  eat?: Record<string, DogAccessInfo>;
}

interface DogAccessLibraryJson {
  schemaVersion: number;
  reviewedAt: string;
  projects: Record<string, ProjectDogAccess>;
}

const parsedLibrary = dogAccessLibrary as DogAccessLibraryJson;
const parsedEastNeukLibrary = eastNeukDogAccessLibrary as DogAccessLibraryJson;
const parsedCrailLibrary = crailDogAccessLibrary as DogAccessLibraryJson;
const parsedCairnOMountLibrary = cairnOMountDogAccessLibrary as DogAccessLibraryJson;
const parsedStonehavenCoastLibrary = stonehavenCoastDogAccessLibrary as DogAccessLibraryJson;
const parsedAberdeenNorthLibrary = aberdeenNorthDogAccessLibrary as DogAccessLibraryJson;
const parsedCarseGowrieLibrary = carseGowrieDogAccessLibrary as DogAccessLibraryJson;

const crailBase = parsedEastNeukLibrary.projects['crail-scotland'] ?? {};
const crailDeep = parsedCrailLibrary.projects['crail-scotland'] ?? {};

export const publishedDogAccess: Record<string, ProjectDogAccess> = {
  ...parsedLibrary.projects,
  ...parsedEastNeukLibrary.projects,
  ...parsedCairnOMountLibrary.projects,
  ...parsedStonehavenCoastLibrary.projects,
  ...parsedAberdeenNorthLibrary.projects,
  ...parsedCarseGowrieLibrary.projects,
  'crail-scotland': {
    ...crailBase,
    ...crailDeep,
    attraction: { ...crailBase.attraction, ...crailDeep.attraction },
    eat: { ...crailBase.eat, ...crailDeep.eat },
  },
};
export const dogAccessReviewedAt = parsedLibrary.reviewedAt;

export function publishedDogAccessForPlace(
  projectId: string,
  kind: DogAccessPlaceKind,
  featureId: string,
): DogAccessInfo | undefined {
  return publishedDogAccess[projectId]?.[kind]?.[featureId];
}

export function publishedDogAccessOrUnconfirmedForPlace(
  projectId: string,
  kind: DogAccessPlaceKind,
  featureId: string,
): DogAccessInfo {
  return (
    publishedDogAccessForPlace(projectId, kind, featureId) ?? {
      rating: 0,
      status: 'unconfirmed',
      label: 'Check before visiting',
      summary:
        "The attraction's dog policy has not yet been confirmed from a current visitor source. Check the official website or contact the operator before travelling with a dog.",
      reviewedAt: dogAccessReviewedAt,
    }
  );
}
