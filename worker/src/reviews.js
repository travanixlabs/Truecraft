/* ==========================================================================
   Google reviews

   Reads the rating and reviews from the Google Places API and caches them in
   KV. Two reasons this runs server-side rather than in the page:

   1. The API key would be readable by anyone if it sat in the front end.
   2. Reviews are Google's dearest SKU (roughly $40 per 1,000 calls). Cached
      for six hours, the site makes about four calls a day regardless of how
      much traffic it gets, instead of one per visitor.

   Google returns at most five reviews and picks which ones. Their terms
   require the author's name and photo to be shown alongside the text and the
   text left unedited, so the front end renders all of it.
   ========================================================================== */

const CACHE_KEY = 'google:reviews:v1';
const CACHE_TTL = 6 * 60 * 60;   // seconds
const FIELDS = 'rating,userRatingCount,googleMapsUri,reviews';

export async function getReviews(env) {
  if (!env.GOOGLE_PLACES_API_KEY || !env.GOOGLE_PLACE_ID) {
    return { configured: false };
  }

  if (env.RATE_LIMIT) {
    const hit = await env.RATE_LIMIT.get(CACHE_KEY, 'json');
    if (hit) return hit;
  }

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(env.GOOGLE_PLACE_ID)}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': FIELDS,
    },
  });

  if (!res.ok) {
    console.error('places api failed', res.status, await res.text());
    // Serve stale rather than nothing if we have it.
    if (env.RATE_LIMIT) {
      const stale = await env.RATE_LIMIT.get(CACHE_KEY + ':stale', 'json');
      if (stale) return stale;
    }
    return { configured: true, error: true };
  }

  const data = await res.json();
  const payload = normalise(data);

  if (env.RATE_LIMIT) {
    await Promise.all([
      env.RATE_LIMIT.put(CACHE_KEY, JSON.stringify(payload), { expirationTtl: CACHE_TTL }),
      // A long-lived copy, so an API outage does not blank the section.
      env.RATE_LIMIT.put(CACHE_KEY + ':stale', JSON.stringify(payload), { expirationTtl: 30 * 86400 }),
    ]);
  }

  return payload;
}

function normalise(data) {
  const reviews = (data.reviews || []).map(r => ({
    author: (r.authorAttribution && r.authorAttribution.displayName) || 'Google user',
    photo: (r.authorAttribution && r.authorAttribution.photoUri) || '',
    profileUri: (r.authorAttribution && r.authorAttribution.uri) || '',
    rating: r.rating || 0,
    text: (r.originalText && r.originalText.text) || (r.text && r.text.text) || '',
    when: r.relativePublishTimeDescription || '',
  })).filter(r => r.text);

  return {
    configured: true,
    rating: typeof data.rating === 'number' ? data.rating : null,
    count: typeof data.userRatingCount === 'number' ? data.userRatingCount : null,
    mapsUri: data.googleMapsUri || '',
    reviews,
  };
}
