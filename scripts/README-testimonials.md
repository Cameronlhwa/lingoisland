# Testimonial Face Generator

This script generates professional avatar images for testimonials using Nano Banana Pro (Gemini's image generation API).

## Setup

1. Make sure you have the API key in your `.env.local`:
   ```
   NANO_BANANA_API_KEY=your_key_here
   # OR
   GOOGLE_API_KEY=your_key_here
   ```

2. Run the generator:
   ```bash
   npm run gen:testimonial-faces
   ```

## What it generates

Creates 5 portrait avatars in `public/testimonials/`:
- `ava.png` - Professional woman, B1 learner
- `daniel.png` - Tech professional man, B2 learner
- `mina.png` - Self-learner woman
- `chris.png` - Busy professional man
- `jason.png` - Asian American heritage learner

## Image style

- Photorealistic DSLR quality portraits
- Professional headshot photography
- Natural lighting with soft focus background
- Business casual attire
- Suitable for professional profiles
- High quality, real person appearance

## Usage in component

The `TestimonialsCarousel` component automatically loads these images from `/testimonials/`.
