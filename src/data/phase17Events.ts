export { PHASE17_CONNECT_EVENTS } from './phase17ConnectEvents'
export { PHASE17_ORIGIN_EVENTS } from './phase17OriginEvents'
export { PHASE17_TRAIT_EVENTS } from './phase17TraitEvents'

import { PHASE17_CONNECT_EVENTS } from './phase17ConnectEvents'
import { PHASE17_ORIGIN_EVENTS } from './phase17OriginEvents'
import { PHASE17_TRAIT_EVENTS } from './phase17TraitEvents'

export const PHASE17_EVENTS = [
  ...PHASE17_CONNECT_EVENTS,
  ...PHASE17_ORIGIN_EVENTS,
  ...PHASE17_TRAIT_EVENTS,
]
