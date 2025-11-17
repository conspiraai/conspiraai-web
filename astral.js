/*
  Astral data + index logic for Conspira AI
  Uses ipgeolocation.io astronomy API with your key.
*/

const IPGEO_API_KEY = '82fd924c51bf4ac48bd9c64119b1d606';
const IPGEO_URL = `https://api.ipgeolocation.io/astronomy?apiKey=${IPGEO_API_KEY}`;

/**
 * Fetch today's astronomy snapshot.
 * Returns a normalized object even if the API fails.
 */
async function getTodayAstralSnapshot() {
  try {
    const res = await fetch(IPGEO_URL);
    if (!res.ok) throw new Error('Astronomy API error');
    const data = await res.json();

    const phase = (data.moon_phase || '').toUpperCase();
    const illumination = Number(data.moon_illumination || 0);
    const distanceKm = Number(data.moon_distance || 0);
    const locationLabel = data.location || 'Your location';

    const score = computeAstralIndex(phase, illumination);
    const tags = buildWindowTags(phase, score);
    const message = buildDailyMessage(phase, score);

    return {
      phase,
      illumination,
      distanceKm,
      locationLabel,
      score,
      tags,
      message
    };
  } catch (err) {
    console.error('Astral snapshot error:', err);

    // Fallback – sane defaults when API fails
    const phase = 'WAXING_CRESCENT';
    const illumination = 23;
    const distanceKm = 403000;
    const score = computeAstralIndex(phase, illumination);
    const tags = buildWindowTags(phase, score);
    const message =
      'Fallback data: treat this as a soft signal only. Overlay with price action and volume.';

    return {
      phase,
      illumination,
      distanceKm,
      locationLabel: 'Fallback',
      score,
      tags,
      message
    };
  }
}

/**
 * Simple scoring model: 0–100
 * Full / New / Perigee windows bias higher.
 */
function computeAstralIndex(phase, illumination) {
  let base = 10;

  const intensePhases = ['FULL_MOON', 'NEW_MOON'];
  const chargedPhases = ['WAXING_GIBBOUS', 'WANING_GIBBOUS'];
  const neutralPhases = ['FIRST_QUARTER', 'LAST_QUARTER'];

  if (intensePhases.includes(phase)) base += 40;
  else if (chargedPhases.includes(phase)) base += 25;
  else if (neutralPhases.includes(phase)) base += 15;
  else base += 8;

  // Illumination weighting
  base += illumination * 0.25;

  // Clamp
  if (base < 0) base = 0;
  if (base > 100) base = 100;

  return Math.round(base);
}

/**
 * Charge labels used for color-coding.
 */
function classifyCharge(score) {
  if (score < 20) return { label: 'Low-charge', className: 'charge-low' };
  if (score < 40) return { label: 'Neutral', className: 'charge-neutral' };
  if (score < 70) return { label: 'Charged', className: 'charge-charged' };
  return { label: 'High alert', className: 'charge-high' };
}

function buildWindowTags(phase, score) {
  const tags = [];

  if (['FULL_MOON', 'NEW_MOON'].includes(phase)) tags.push('Lunar cycle overlay');
  if (score >= 40 && score < 70) tags.push('Volatility watch');
  if (score >= 70) tags.push('High-tension window');

  return tags;
}

function buildDailyMessage(phase, score) {
  const { label } = classifyCharge(score);

  if (score < 20)
    return 'Better for accumulation, journaling, and resets. Expect quieter moves unless news overrides.';
  if (score < 40)
    return 'Flows and news matter more than the stars. Use this as a soft overlay, not a driver.';
  if (score < 70)
    return 'Window statistically tilts toward elevated volatility. Watch for fakeouts and liquidity grabs.';
  return 'High-alert band. Historically associated with outsized moves and liquidation cascades. Size down and stay nimble.';
}

/**
 * Build a 7-day synthetic forecast from today’s score.
 * Just a directional curve, not real future astronomy.
 */
function buildSevenDayForecast(todayScore, todayPhase) {
  const days = [];
  const labels = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

  for (let i = 0; i < 7; i++) {
    // simple curve – soften away from today
    const delta = i === 0 ? 0 : (i <= 3 ? 6 - 2 * i : -4 + (i - 3) * 2);
    let score = todayScore + delta;
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    const charge = classifyCharge(score);
    const desc =
      i === 0
        ? 'Current astral tension vs. baseline.'
        : 'Projected astral tension vs. today’s baseline.';

    days.push({
      label: labels[i],
      description: desc,
      score,
      chargeLabel: charge.label,
      chargeClass: charge.className
    });
  }

  return days;
}
