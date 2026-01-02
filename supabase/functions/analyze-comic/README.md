# Welcome to Your Miaoda Project
Miaoda Application Link URL
    URL:https://medo.dev/projects/app-7whklnxpov0h

# Analyze Comic Edge Function

## Overview

This Supabase Edge Function uses Google Gemini Vision API to automatically extract comic book metadata from cover images.

## Features

- Extracts title, issue number, publisher, publication year
- Identifies key characters and story arcs
- Detects artist and writer information
- Returns structured JSON data

## Setup

### 1. Add Gemini API Key

You need to add your Gemini API key to Supabase secrets:

```bash
# Using Supabase CLI
supabase secrets set GEMINI_API_KEY=your-gemini-api-key-here
```

Or use the `supabase_bulk_create_secrets` tool with:
```json
[
  {
    "name": "GEMINI_API_KEY",
    "value": "your-gemini-api-key-here"
  }
]
```

### 2. Deploy Function

```bash
# Deploy to Supabase
supabase functions deploy analyze-comic
```

Or use the `supabase_deploy_edge_function` tool with:
- name: `analyze-comic`

## Usage

### Request

```typescript
const { data, error } = await supabase.functions.invoke('analyze-comic', {
  body: {
    image_base64: 'base64_encoded_image_data'
  }
});
```

### Request Body

```json
{
  "image_base64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### Response (Success)

```json
{
  "success": true,
  "metadata": {
    "title": "Amazing Spider-Man",
    "issue_number": "300",
    "publisher": "Marvel Comics",
    "publication_year": "1988",
    "variant": null,
    "key_characters": ["Spider-Man", "Venom"],
    "key_events": ["First full appearance of Venom"],
    "artist": "Todd McFarlane",
    "writer": "David Michelinie",
    "notable_markings": ["Black costume", "Classic cover"]
  }
}
```

### Response (Error)

```json
{
  "success": false,
  "error": "Error message"
}
```

## Frontend Integration Example

```typescript
import { supabase } from '@/db/supabase';

const analyzeComicCover = async (imageUrl: string) => {
  try {
    // Fetch image as blob
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    // Convert to base64
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
    
    // Call Edge Function
    const { data, error } = await supabase.functions.invoke('analyze-comic', {
      body: { image_base64: base64 }
    });
    
    if (error) throw error;
    
    if (!data.success) {
      throw new Error(data.error);
    }
    
    return data.metadata;
  } catch (error) {
    console.error('Failed to analyze comic:', error);
    throw error;
  }
};

// Usage
const metadata = await analyzeComicCover('https://example.com/comic.jpg');
console.log(metadata.title); // "Amazing Spider-Man"
```

## Cost Considerations

### Google Gemini API Pricing

- **Gemini 1.5 Flash:** Free tier available
- **Free Tier:** 15 requests per minute, 1500 requests per day
- **Paid Tier:** $0.075 per 1M input tokens, $0.30 per 1M output tokens

**Estimated Cost:**
- **Free Tier:** 0 cost for up to 1500 analyses per day
- **Paid Tier:** ~$0.001 - $0.002 per comic cover analysis
- 100 analyses = ~$0.10-0.20
- 1000 analyses = ~$1-2

**Gemini is significantly cheaper than OpenAI!**

### Optimization Tips

1. **Cache Results** - Store analysis in database, don't re-analyze
2. **Resize Images** - Reduce to 512x512 or 1024x1024 before sending
3. **Rate Limiting** - Stay within free tier limits (15/min, 1500/day)
4. **Batch Processing** - Analyze multiple comics in one request

## Error Handling

The function handles these error cases:

- Missing Gemini API key
- Missing image_base64 parameter
- Gemini API errors (rate limit, invalid key, etc.)
- JSON parsing errors
- Network errors

## Testing

### Test Locally

```bash
# Start local Supabase
supabase start

# Serve function locally
supabase functions serve analyze-comic --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/analyze-comic \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "..."}'
```

### Test in Production

```typescript
// Test with a sample comic cover
const testImageUrl = 'https://example.com/test-comic.jpg';
const metadata = await analyzeComicCover(testImageUrl);
console.log('Extracted metadata:', metadata);
```

## Limitations

- Requires clear, readable comic cover image
- May not work well with:
  - Very old/damaged covers
  - Foreign language comics
  - Heavily stylized/abstract covers
  - Low resolution images
- Accuracy depends on Gemini's training data
- May hallucinate details if unsure

## Security

- ✅ API key stored securely in Supabase secrets
- ✅ CORS headers configured
- ✅ Input validation
- ✅ Error handling
- ✅ No sensitive data logged

## Monitoring

Check function logs:
```bash
supabase functions logs analyze-comic
```

Monitor usage:
- Google Cloud Console for API usage
- Supabase dashboard for function invocations

## Troubleshooting

### "GEMINI_API_KEY not configured"
- Add API key to Supabase secrets
- Redeploy function after adding secret

### "Failed to parse comic metadata"
- Image may be unclear or not a comic cover
- Try with a different image
- Check Gemini API response in logs

### "Gemini API request failed"
- Check API key is valid
- Check Google Cloud project has Gemini API enabled
- Check rate limits (15/min, 1500/day on free tier)

### Rate Limit Errors
- Implement rate limiting in frontend
- Add retry logic with exponential backoff
- Consider caching results
- Upgrade to paid tier if needed

## Future Enhancements

1. **Condition Analysis** - Detect wear, tears, defects
2. **Value Estimation** - Cross-reference with price databases
3. **Batch Analysis** - Analyze multiple comics at once
4. **Smart Caching** - Store results by image hash
5. **Fallback Models** - Use cheaper models for simple cases

---

**Status:** Ready to deploy
**Date:** December 2, 2025
**Version:** 1.0
