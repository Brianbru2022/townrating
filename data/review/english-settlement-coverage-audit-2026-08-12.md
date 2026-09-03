# English settlement coverage audit

Reviewed: 12 August 2026

## Scope

This audit covers the English regions currently represented in the published catalogue:

- Northamptonshire and North Northamptonshire
- Cambridgeshire
- Lincolnshire, North Lincolnshire and North East Lincolnshire
- Leicestershire and the City of Leicester
- Buckinghamshire
- Rutland

The live comparison source is OpenStreetMap `place=city|town|village` data within each ceremonial county. The full machine-readable candidate list is in `english-settlement-coverage-candidates-2026-08-12.json`.

Mapped absence is only the first filter. A settlement is recommended below only where it appears capable of supporting a genuine visitor guide under the app's strict rating rules. A church, park, museum or railway outside the active settlement polygon should normally remain a standalone Home attraction rather than artificially raising the settlement.

## Coverage summary

| Region | Published guides | Live mapped settlements | Raw unmatched candidates | Finding |
| --- | ---: | ---: | ---: | --- |
| Northamptonshire | 179 | 287 | 124 | No missing city or town; remaining candidates are villages or name variants. |
| Cambridgeshire | 133 | 297 | 165 | No missing city or town; only a small number of villages merit editorial review. |
| Lincolnshire | 197 | 502 | 329 | Core visitor towns are covered; `Bracebridge` is part of Lincoln rather than a separate destination. |
| Leicestershire | 159 | 305 | 158 | One clear town omission: Hinckley. |
| Buckinghamshire | 5 | 232 | 227 | This is a partial starter set, not county-wide coverage. It is the main gap. |
| Rutland | 2 | 54 | 52 | Oakham and Uppingham are covered, but several visitor villages are absent. |

Raw unmatched counts include hamlets promoted to `village` in OSM, spelling differences, merged settlements and suburban names. They must not be treated as an automatic import queue.

## Add next

### Highest priority

1. **Hinckley, Leicestershire** - the only clearly missing mapped town in the otherwise broad Leicestershire batch. It has Hinckley and District Museum and the Triumph Factory Visitor Experience. It needs a full polygon-led audit before a rating is assigned.
2. **Amersham, Buckinghamshire** - Old Amersham provides a coherent historic townscape and museum visit.
3. **Aylesbury, Buckinghamshire** - county town with a historic core, Discover Bucks Museum and a sufficient urban visitor offer.
4. **Great Missenden, Buckinghamshire** - historic High Street and the Roald Dahl Museum provide a clear visitor identity.
5. **Marlow, Buckinghamshire** - historic Thames-side market town with a coherent walking and food visit.
6. **Beaconsfield, Buckinghamshire** - Old Town character and Bekonscot Model Village create a sufficiently distinct visitor offer, subject to the normal polygon check.
7. **West Wycombe, Buckinghamshire** - unusually strong village destination combining the National Trust village, park and hill, St Lawrence's Church, mausoleum, trail and Hellfire Caves.
8. **High Wycombe, Buckinghamshire** - historic furniture-making identity and museum provision; nearby properties must not be counted if outside its polygon.
9. **Stony Stratford, Buckinghamshire** - historic coaching town with a distinct high-street visitor experience.
10. **Wendover, Buckinghamshire** - Chiltern market-town base with heritage and walking potential.
11. **Winslow, Buckinghamshire** - compact historic market town suitable for a smaller guide.
12. **Lyddington, Rutland** - picturesque ironstone village with the Bede House, church, heritage trail and visitor facilities.

### Add after a focused visitor audit

- **Chesham, Buckinghamshire** - historic town with local heritage, but likely a lower tourist rating than Amersham or Marlow.
- **Princes Risborough, Buckinghamshire** - useful Chiltern gateway; assess whether the town itself offers enough beyond access to surrounding countryside.
- **Brill, Haddenham, Ivinghoe and Long Crendon, Buckinghamshire** - distinctive historic villages or former market settlements that may support zero- or one-star guides after polygon checks.
- **Denham and Hambleden, Buckinghamshire** - attractive historic villages; keep film-location fame and nearby countryside separate from in-polygon attractions.
- **Waddesdon, Buckinghamshire** - the village may merit a guide, but Waddesdon Manor must remain a standalone attraction if it falls outside the settlement polygon.
- **Upper Hambleton, Edith Weston, Empingham and Whitwell, Rutland** - useful Rutland Water visitor settlements, but water attractions must be assigned by their actual coordinates rather than borrowed from the village name.
- **Greetham and Market Overton, Rutland** - attractive villages with local visitor interest; likely zero or one star under the strict town scale.

## Better as standalone attractions first

- **Ludborough / North Thoresby, Lincolnshire** - the Lincolnshire Wolds Railway is a genuine visitor attraction, but the railway should be audited as a standalone attraction before either village receives a town guide.
- **Donington le Heath, Leicestershire** - the 1620s House and Garden is a strong attraction. Create or improve the attraction entry first; do not assume the wider village earns the same score.
- **Great Paxton, Cambridgeshire** - the Saxon Minster Church of the Holy Trinity is notable, but one church alone does not establish a rated tourist town.
- **Grafton Underwood, Northamptonshire** - the USAAF memorial and church window have specialist interest, while much of the former airfield is private. Treat the accessible visitor sites separately before considering a village guide.

## No immediate addition needed

- **Northamptonshire:** no absent city or town was found. The remaining village list is dominated by modest settlements, mapped name variants and places whose interest is a single church or memorial.
- **Cambridgeshire:** no absent city or town was found. The broad destination set, including Cambridge, Ely, Peterborough, Huntingdon, St Ives, St Neots and Wisbech, is already present.
- **Lincolnshire:** the recognised visitor-town network is already represented. `Bracebridge` should remain part of Lincoln, not become a separate guide.
- **Leicestershire:** after adding Hinckley, remaining gaps are chiefly small villages or standalone-attraction locations.

## Recommended delivery order

1. Add and fully research Hinckley.
2. Build the missing Buckinghamshire town set, starting with Amersham, Aylesbury, Great Missenden, Marlow, West Wycombe and High Wycombe.
3. Add Lyddington, then assess the Rutland Water villages individually against their polygons.
4. Audit the four standalone-attraction candidates before creating any associated village guides.
5. Re-run `scripts/audit-english-settlement-coverage.ts` after each county batch.

## Authoritative visitor sources used

- [Buckinghamshire Council historic towns project](https://www.buckinghamshire.gov.uk/planning-building-and-environment/conservation-heritage-and-archaeology/historic-environment-record/buckinghamshires-historic-towns/)
- [Buckinghamshire settlement review](https://media.buckinghamshire.gov.uk/documents/Settlement_Review_May_2025.pdf)
- [National Trust: West Wycombe Park, Village and Hill](https://www.nationaltrust.org.uk/visit/oxfordshire-buckinghamshire-berkshire/west-wycombe-park-village-and-hill)
- [Visit Leicester and Leicestershire group travel guide](https://www.visitleicester.info/dbimgs/Group%20Travel%20Guide%202024.pdf)
- [Discover Rutland: Lyddington Bede House](https://discover-rutland.co.uk/listing/lyddington-bede-house/)
- [Discover Rutland: Vibrant Villages](https://discover-rutland.co.uk/blog/vibrant-villages-part-1/)
- [Lincolnshire Wolds Railway](https://www.lincolnshirewoldsrailway.co.uk/)
- [The 1620s House and Garden](https://1620shouse.org.uk/visit/explore/the-1620s-house/)
- [Great Paxton Parish Council](https://greatpaxton-pc.gov.uk/)
- [384th Bombardment Group Museum visitor information](https://384thbombardmentgroupmuseum.org.uk/visit/visit-us)
