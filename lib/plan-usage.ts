// "2 of 3 branches used" for the plan meters (pure, for tests and the browser).

export type PlanUsage = {
  /** "2 of 3 branches used", or "2 branches" when the plan sets no limit. */
  text: string;
  /** 0–100 for the meter; 0 when there's no limit. */
  percent: number;
  atLimit: boolean;
  /** One left. */
  nearLimit: boolean;
};

export function planUsage(current: number, max: number | null | undefined, one: string, many = `${one}s`): PlanUsage {
  const noun = (n: number) => (n === 1 ? one : many);
  if (max === null || max === undefined || max < 0) {
    return { text: `${current} ${noun(current)}`, percent: 0, atLimit: false, nearLimit: false };
  }
  const atLimit = current >= max;
  return {
    text: `${current} of ${max} ${noun(max)} used`,
    percent: max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 100,
    atLimit,
    nearLimit: !atLimit && max - current === 1,
  };
}
