# Island Library

This directory contains 20 pre-generated island images used throughout the app.

## Generation

To generate the library images (one-time operation):

```bash
npm run gen:island-library
```

This will:
- Use NanoBanana Pro (`gemini-3-pro-image-preview`)
- Generate 20 themed island images based on predefined topics
- Save them as PNG files in this directory
- Each generation uses the EXACT prompt specified in the requirements

## Usage

Islands are assigned a random `cover_key` at creation time, which points to one of these pre-generated images. This eliminates the need for expensive on-the-fly generation.

## Backfilling

To assign cover images to existing islands that don't have one:

```bash
npm run backfill:island-covers
```

## Topics

The 20 pre-generated topics are:
1. Harbin ice city winter festival
2. Modern China skyline with advanced technology
3. Ancient China palace courtyard
4. Tropical Hainan beach vacation
5. Singapore Marina Bay futuristic city
6. China with flying cars future city
7. Beijing hutong street life
8. Shanghai night skyline neon
9. Chengdu panda city vibe
10. Xi'an terracotta warriors history
11. Guilin karst mountains river cruise
12. Hong Kong dense skyline trams
13. Tibetan plateau mountains and prayer flags
14. Silk Road desert caravan vibe
15. Chinese high-speed rail travel
16. Lantern festival night market
17. Traditional tea house calm vibes
18. Dragon boat festival river race
19. Snowy northern China countryside
20. Futuristic smart city with robots

## Cost Savings

By using pre-generated images instead of generating on-the-fly:
- No Gemini API calls for every new island
- Instant image loading (local files)
- Consistent visual quality
- Significant cost reduction for the product
