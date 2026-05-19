# SEO + Google Analytics + Google Search Console Setup

This project now has production SEO foundations in place.

## Files changed

- `app/layout.tsx`
  - Meta title
  - Meta description
  - Meta keywords
  - Open Graph
  - Twitter card
  - Google Search Console verification placeholder
  - Google Analytics loader

- `lib/seoConfig.ts`
  - Central SEO title, description, keywords, and site URL helpers.

- `components/GoogleAnalytics.tsx`
  - Loads GA4 only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is present.
  - Sends page views during client-side route navigation.

- `app/sitemap.ts`
  - Generates `/sitemap.xml` for Google Search Console.

- `app/robots.ts`
  - Generates `/robots.txt`.
  - Allows public pages and blocks internal admin/diagnostics pages from indexing.

- `app/manifest.ts`
  - Updated PWA app description.

- `public/og-cover.png`
  - Social sharing cover image for Open Graph and Twitter/X previews.

- `.env.local.example`
  - Added SEO/analytics environment variables.

## Required environment variables

Add these to Vercel or your hosting provider:

```bash
NEXT_PUBLIC_SITE_URL=https://your-live-domain.com
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=your_google_search_console_verification_token
```

For Google Search Console, paste only the `content` value from:

```html
<meta name="google-site-verification" content="PASTE_THIS_PART_ONLY" />
```

## After deployment

1. Deploy the site.
2. Open `/robots.txt` and confirm it loads.
3. Open `/sitemap.xml` and confirm it lists your live domain.
4. In Google Search Console, add your live URL as a URL Prefix property.
5. Verify using the HTML tag method or GA method.
6. Submit `/sitemap.xml` in Search Console.
7. In Google Analytics, use Realtime view to confirm page views.

## Important note about keywords

The keywords meta tag is included because you asked for it, but Google Search does not use meta keywords for ranking. The important SEO assets are the title, description, sitemap, robots, useful page content, structured public pages, and Google Search Console setup.
