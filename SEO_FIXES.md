# Google Search Console SEO Fixes

## Issues Fixed

### 1. **Duplicate without user-selected canonical**
- **Problem**: `www.lingoisland.com` and `lingoisland.com` showing as duplicates
- **Solution**: 
  - Created `middleware.ts` to redirect all `www.` traffic to non-www with 301 redirect
  - Updated `next.config.js` with backup redirect rules
  - Updated `site-url.ts` to normalize URLs and remove www
  - Landing page already has canonical URL set to `https://lingoisland.com`

### 2. **Page with redirect**
- **Problem**: Redirect chains or improper redirects
- **Solution**:
  - Middleware handles www → non-www (301 permanent)
  - Middleware redirects http → https in production (301 permanent)
  - All redirects are proper 301 (permanent) redirects

### 3. **SEO Improvements**
- **robots.ts**: Already exists with proper directives
  - Allows landing pages to be indexed
  - Blocks `/app/`, `/api/`, `/auth/` from search engines
  - Points to sitemap location
- **Canonical URLs**: All pages use consistent non-www URLs
- **Site URL normalization**: Removes trailing slashes and www

## Files Changed

1. **`middleware.ts`** (NEW)
   - Handles www → non-www redirect (301)
   - Handles http → https redirect (301)
   - Applies to all routes except API, static files, and images

2. **`next.config.js`**
   - Added backup redirect rule for www to non-www

3. **`lib/utils/site-url.ts`**
   - Added `getCanonicalUrl()` helper function
   - Updated normalization to remove www

4. **`app/robots.ts`** (Already exists)
   - Already properly configured
   - Blocks app routes from indexing
   - Points to sitemap

## Expected Results

After these changes and Google re-crawling:

1. ✅ **"Duplicate without user-selected canonical"** will resolve
   - All www URLs will 301 redirect to non-www
   - Google will index only `lingoisland.com`

2. ✅ **"Page with redirect"** will resolve
   - All redirects are proper 301 permanent redirects
   - No redirect chains

3. ✅ **Better SEO**
   - Consistent canonical URLs
   - Proper robots.txt directives
   - Protected app routes from indexing

## Next Steps

1. Deploy these changes to production
2. In Google Search Console:
   - Click "Validate Fix" on each issue
   - Wait for Google to re-crawl (may take a few days)
3. Consider adding a sitemap.xml for better discoverability (optional)

## Monitoring

- Monitor in Google Search Console → Coverage report
- Both issues should show "Passed" after validation
- Watch for any new indexing issues
