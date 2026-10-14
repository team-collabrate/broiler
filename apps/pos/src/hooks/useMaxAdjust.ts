import { useEffect, useState } from 'react';
import { DEFAULT_MAX_ADJUST_MINOR, subscribeMaxAdjust } from '@broiler/shared';

/** How far the counter may move a sale's rate from the list rate, in paise (the owner's setting, else the default). */
export function useMaxAdjust(): number {
  const [maxAdjustMinor, setMax] = useState(DEFAULT_MAX_ADJUST_MINOR);
  useEffect(() => subscribeMaxAdjust(setMax), []);
  return maxAdjustMinor;
}
