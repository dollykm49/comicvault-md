import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Analyze Comic Cover - Supabase Edge Function
 * 
 * Uses Google Gemini Vision API to extract comic book metadata from cover images.
 * 
 * Request Body:
 * {
 *   "image_base64": "base64_encoded_image_data"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "metadata": {
 *     "title": "Amazing Spider-Man",
 *     "issue_number": "300",
 *     "publisher": "Marvel Comics",
 *     "publication_year": "1988",
 *     "variant": null,
 *     "key_characters": ["Spider-Man", "Venom"],
 *     "key_events": ["First full appearance of Venom"],
 *     "artist": "Todd McFarlane",
 *     "writer": "David Michelinie",
 *     "notable_markings": ["Black costume", "Classic cover"]
 *   }
 * }
 */

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Parse request body
    const { image_base64 } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'image_base64 is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Analyzing comic cover with Gemini Vision...');

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `You are a comic book expert. Analyze this comic cover and extract:

- Title
- Issue Number
- Publisher
- Publication Year
- Variant (if any)
- Key Characters appearing
- Key events or story arc
- Artist / Writer (if visible on cover)
- Notable markings or features

If unsure, give your best guess.
Return JSON ONLY in this exact format:
{
  "title": "string",
  "issue_number": "string",
  "publisher": "string",
  "publication_year": "string",
  "variant": "string or null",
  "key_characters": ["array of strings"],
  "key_events": ["array of strings"],
  "artist": "string",
  "writer": "string",
  "notable_markings": ["array of strings"]
}`
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: image_base64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      console.error('Gemini API error:', errorData);
      throw new Error(errorData.error?.message || 'Gemini API request failed');
    }

    const result = await geminiResponse.json();
    console.log('Gemini response received');

    // Extract and parse the metadata
    const content = result.candidates[0].content.parts[0].text;
    
    // Try to parse JSON from the response
    let metadata;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      metadata = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', content);
      throw new Error('Failed to parse comic metadata from AI response');
    }

    console.log('Successfully extracted metadata:', metadata);

    return new Response(
      JSON.stringify({ 
        success: true, 
        metadata 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in analyze-comic function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
